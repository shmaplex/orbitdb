import PQueue from "p-queue";
import type { AccessControllerInstance as AccessController } from "../access-controllers";
import type { StorageBackend } from "../storage";
import Clock, { tickClock } from "./clock";
import ConflictResolution from "./conflict-resolution";
import Entry, { type Entry as EntryType } from "./entry";
import OplogStore, { type OplogStoreInstance } from "./oplog-store";

const { LastWriteWins, NoZeroes } = ConflictResolution;

const randomId = () => Date.now().toString();
const maxClockTimeReducer = (res: number, acc: EntryType) =>
  Math.max(res, acc.clock.time);

/** @module Log */

export interface Encryption {
  /** Encryption/decryption for data payloads */
  data?: {
    encrypt?: (data: Uint8Array) => Promise<Uint8Array>;
    decrypt?: (data: Uint8Array) => Promise<Uint8Array>;
  };
  /** Optional encryption/decryption for replication payloads */
  replication?: {
    encrypt?: (data: Uint8Array) => Promise<Uint8Array>;
    decrypt?: (data: Uint8Array) => Promise<Uint8Array>;
  };
}

export interface LogOptions {
  logId?: string;
  logHeads?: EntryType[];
  access?: AccessController;
  entryStorage?: StorageBackend;
  headsStorage?: StorageBackend;
  indexStorage?: StorageBackend;
  sortFn?: (a: EntryType, b: EntryType) => number;
  encryption?: Encryption;
}

export interface LogInstance {
  id: string;
  clock: () => Promise<ReturnType<typeof Clock>>;
  heads: () => Promise<EntryType[]>;
  values: () => Promise<EntryType[]>;
  all: () => Promise<EntryType[]>;
  get: (hash: string) => Promise<EntryType | undefined>;
  has: (hash: string) => Promise<boolean>;
  append: (
    data: any,
    options?: { referencesCount: number }
  ) => Promise<EntryType>;
  join: (log: LogInstance) => Promise<void>;
  joinEntry: (entry: EntryType) => Promise<boolean>;
  traverse: (
    rootEntries?: EntryType[],
    shouldStopFn?: (entry: EntryType) => Promise<boolean>
  ) => AsyncGenerator<EntryType>;
  iterator: (options?: {
    amount?: number;
    gt?: string;
    gte?: string;
    lt?: string | EntryType[];
    lte?: string | EntryType[];
  }) => AsyncGenerator<EntryType>;
  clear: () => Promise<void>;
  close: () => Promise<void>;
  access: AccessController;
  identity: any;
  storage: OplogStoreInstance & StorageBackend;
  encryption: Encryption;
}

/** Default access controller allowing all appends */
const DefaultAccessController: () => Promise<AccessController> = async () => ({
  type: "default",
  canAppend: async (_entry: EntryType) => true,
});

/**
 * Creates a new log instance.
 * @param identity Identity object
 * @param options Log options
 * @returns LogInstance
 */
const Log = async (
  identity: any,
  options: LogOptions = {}
): Promise<LogInstance> => {
  const {
    logId,
    logHeads,
    access: _access,
    entryStorage,
    headsStorage,
    indexStorage,
    sortFn: _sortFn,
    encryption: _encryption,
  } = options;

  if (!identity) throw new Error("Identity is required");
  if (logHeads != null && !Array.isArray(logHeads))
    throw new Error("'logHeads' argument must be an array");

  const id = logId || randomId();
  const encryption: Encryption = _encryption || {};
  const encryptPayloadFn = encryption.data?.encrypt;
  const access: AccessController = _access || (await DefaultAccessController());

  const oplogStore = await OplogStore({
    logHeads: logHeads?.map((e) => e.hash).filter((h): h is string => !!h),
    entryStorage,
    indexStorage,
    headsStorage,
    encryption,
  });

  const sortFn = NoZeroes(_sortFn || LastWriteWins);
  const appendQueue = new PQueue({ concurrency: 1 });
  const joinQueue = new PQueue({ concurrency: 1 });

  /** Returns current clock */
  const clock = async () => {
    const heads_ = await heads();
    const maxTime = heads_.reduce(maxClockTimeReducer, 0);
    return Clock(identity.publicKey, maxTime);
  };

  /** Returns current heads of the log */
  const heads = async (): Promise<EntryType[]> => {
    const heads_ = await oplogStore.heads();
    return heads_.sort(sortFn).reverse();
  };

  /** Returns all values in the log */
  const values = async (): Promise<EntryType[]> => {
    const vals: EntryType[] = [];
    for await (const entry of traverse()) vals.unshift(entry);
    return vals;
  };

  /** Returns a specific entry by hash */
  const get = async (hash: string): Promise<EntryType | undefined> => {
    if (!hash) throw new Error("hash is required");
    return oplogStore.get(hash);
  };

  /** Checks if an entry exists */
  const has = async (hash: string): Promise<boolean> => oplogStore.has(hash);

  const getReferences = async (
    heads: EntryType[],
    amount = 0
  ): Promise<string[]> => {
    const refs: string[] = [];
    const stopFn = async (entry: EntryType) =>
      refs.length >= amount && amount !== -1;
    for await (const entry of traverse(heads, stopFn)) {
      if (entry.hash) refs.push(entry.hash);
    }
    return refs.slice(heads.length + 1, amount);
  };

  /** Append a new entry to the log */
  const append = async (
    data: any,
    { referencesCount = 0 } = {}
  ): Promise<EntryType> => {
    const task = async (): Promise<EntryType> => {
      const heads_ = await heads();
      const nexts = heads_.map((e) => e.hash).filter((h): h is string => !!h);
      const refs = await getReferences(heads_, referencesCount + heads_.length);

      const entry = await Entry.create(
        identity,
        id,
        data,
        encryptPayloadFn,
        tickClock(await clock()),
        nexts,
        refs
      );

      if (!(await access.canAppend(entry))) {
        throw new Error(
          `Could not append entry: key "${identity.hash}" is not allowed`
        );
      }

      const entryHash = await oplogStore.setHead(entry);
      if (!entryHash) throw new Error("Failed to set head: entry hash missing");
      entry.hash = entryHash;

      return entry;
    };

    return appendQueue.add(task, { throwOnTimeout: true });
  };

  /** Joins a single entry into the log */
  const joinEntry = async (entry: EntryType): Promise<boolean> => {
    if (!entry.hash) return false;
    if (await has(entry.hash)) return false;

    const verifyEntry = async (e: EntryType) => {
      if (e.id !== id)
        throw new Error(
          `Entry's id (${e.id}) doesn't match the log's id (${id}).`
        );
      if (!(await access.canAppend(e)))
        throw new Error(
          `Could not append entry: key "${e.identity}" is not allowed.`
        );
      if (!(await Entry.verify(identity, e)))
        throw new Error(`Invalid signature for ${e.hash}`);
    };

    await verifyEntry(entry);

    const headsHashes = (await heads())
      .map((e) => e.hash)
      .filter((h): h is string => !!h);
    const hashesToAdd = new Set<string>([entry.hash]);
    const hashesToGet = new Set([...entry.next, ...entry.refs]);
    const connectedHeads = new Set<string>();

    const traverseAndVerify = async () => {
      const entries = await Promise.all(Array.from(hashesToGet).map(get));
      for (const e of entries.filter((e): e is EntryType => !!e)) {
        if (!e.hash) continue;
        hashesToGet.delete(e.hash);
        await verifyEntry(e);
        hashesToAdd.add(e.hash);
        for (const hash of [...e.next, ...e.refs]) {
          const alreadyHas = await has(hash);
          if (!alreadyHas && !hashesToAdd.has(hash)) hashesToGet.add(hash);
          else if (headsHashes.includes(hash)) connectedHeads.add(hash);
        }
      }
      if (hashesToGet.size > 0) await traverseAndVerify();
    };

    await traverseAndVerify();
    await oplogStore.addVerified(Array.from(hashesToAdd));
    await oplogStore.removeHeads(Array.from(connectedHeads));
    await oplogStore.addHead(entry);

    return true;
  };

  /** Joins another log instance */
  const join = async (log: LogInstance) => {
    if (!log) throw new Error("Log instance not defined");
    if (!isLog(log))
      throw new Error("Given argument is not an instance of Log");

    await oplogStore.storage.merge(log.storage);
    for (const entry of await log.heads()) await joinEntry(entry);
  };

  /** Traverses log entries */
  const traverse = async function* (
    rootEntries?: EntryType[],
    shouldStopFn?: (entry: EntryType) => Promise<boolean>
  ): AsyncGenerator<EntryType> {
    const stopFn = shouldStopFn || (async () => false);
    const entriesToTraverse = rootEntries || (await heads());
    let stack = entriesToTraverse.slice().sort(sortFn);
    const traversed: Record<string, boolean> = {};
    let toFetch: string[] = [];
    const fetched: Record<string, boolean> = {};
    const notIndexed = (hash: string) => !(traversed[hash] || fetched[hash]);

    while (stack.length > 0) {
      stack = stack.sort(sortFn);
      const entry = stack.pop();
      if (!entry || !entry.hash || traversed[entry.hash]) continue;

      yield entry;
      if (await stopFn(entry)) break;

      traversed[entry.hash] = true;
      fetched[entry.hash] = true;

      toFetch = [...toFetch, ...entry.next].filter(notIndexed);
      const nextEntries = await Promise.all(
        toFetch.map((h) => (notIndexed(h) ? get(h) : undefined))
      );
      const validNexts = nextEntries.filter(
        (e): e is EntryType => !!e && !!e.hash
      );

      toFetch = validNexts
        .reduce(
          (res: string[], acc) => Array.from(new Set([...res, ...acc.next])),
          []
        )
        .filter(notIndexed);

      stack = [...validNexts, ...stack];
    }
  };

  /** Returns an iterator over entries */
  const iterator = async function* ({
    amount = -1,
    gt,
    gte,
    lt,
    lte,
  }: {
    amount?: number;
    gt?: string;
    gte?: string;
    lt?: string | EntryType[];
    lte?: string | EntryType[];
  } = {}): AsyncGenerator<EntryType> {
    if (amount === 0) return;

    const startEntries: EntryType[] = [];
    if (typeof lt === "string") {
      const entry = await get(lt);
      if (!entry || !entry.hash) return;
      startEntries.push(entry);

      const nextEntries = (await Promise.all(entry.next.map(get))).filter(
        (e): e is EntryType => !!e && !!e.hash
      );
      startEntries.push(...nextEntries);
    } else if (Array.isArray(lt)) startEntries.push(...lt);
    if (Array.isArray(lte)) startEntries.push(...lte);
    if (!startEntries.length) startEntries.push(...(await heads()));

    const end = gt || gte ? await get(gt || gte!) : null;
    const amountToIterate = end || amount === -1 ? -1 : amount;
    let count = 0;

    const shouldStopTraversal = async (entry: EntryType) => {
      count++;
      if (count >= amountToIterate && amountToIterate !== -1) return true;
      if (end && Entry.isEqual(entry, end)) return true;
      return false;
    };

    for await (const entry of traverse(startEntries, shouldStopTraversal)) {
      const skipFirst = lt && Entry.isEqual(entry, startEntries[0]);
      const skipLast = gt && end && Entry.isEqual(entry, end);
      if (!skipFirst && !skipLast) yield entry;
    }
  };

  /** Clears all entries */
  const clear = async (): Promise<void> => {
    await appendQueue.clear();
    await joinQueue.clear();
    await oplogStore.clear();
  };

  /** Closes the log */
  const close = async (): Promise<void> => {
    await appendQueue.onIdle();
    await joinQueue.onIdle();
    await oplogStore.close();
  };

  const isLog = (obj: any): obj is LogInstance =>
    obj &&
    typeof obj.id === "string" &&
    typeof obj.clock === "function" &&
    typeof obj.heads === "function" &&
    typeof obj.values === "function" &&
    typeof obj.access === "object" &&
    typeof obj.identity !== "undefined" &&
    typeof obj.storage !== "undefined";

  return {
    id,
    clock,
    heads,
    values,
    all: values,
    get,
    has,
    append,
    join,
    joinEntry,
    traverse,
    iterator,
    clear,
    close,
    access,
    identity,
    storage: oplogStore.storage as OplogStoreInstance & StorageBackend,
    encryption,
  };
};

export { Log as default, DefaultAccessController, Clock };
export type LogEntry = EntryType;

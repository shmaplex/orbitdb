// src/oplog/oplog-store.ts
import type { StorageBackend } from "../storage";
import { MemoryStorage } from "../storage";
import Entry, { type EntryType } from "./entry";
import Heads, { type HeadsOptions } from "./heads";

export type EncryptFn = (data: Uint8Array) => Promise<Uint8Array>;
export type DecryptFn = (data: Uint8Array) => Promise<Uint8Array>;

/**
 * Default storage for storing the Log and its entries.
 * Now properly typed as a function returning a StorageBackend promise
 */
const DefaultStorage = async (): Promise<StorageBackend> => MemoryStorage();

/**
 * OplogStore instance interface
 */
export interface OplogStoreInstance {
  get(hash: string): Promise<EntryType | undefined>;
  getBytes(hash: string): Promise<Uint8Array | undefined>;
  has(hash: string): Promise<boolean>;
  heads(): Promise<EntryType[]>;
  setHead(entry: EntryType): Promise<string>;
  addHead(entry: EntryType): Promise<string>;
  removeHeads(hashes: string[]): Promise<void>;
  addVerified(hashes: string[]): Promise<void>;
  storage: StorageBackend;
  clear(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Creates an instance of OplogStore
 */
const OplogStore = async ({
  logHeads,
  entryStorage,
  headsStorage,
  indexStorage,
  encryption,
}: {
  logHeads?: EntryType[] | string[];
  entryStorage?: StorageBackend;
  headsStorage?: StorageBackend;
  indexStorage?: StorageBackend;
  encryption?: {
    replication?: { encrypt?: EncryptFn; decrypt?: DecryptFn };
    data?: { encrypt?: EncryptFn; decrypt?: DecryptFn };
  };
} = {}): Promise<OplogStoreInstance> => {
  const encryptEntryFn: EncryptFn | undefined =
    encryption?.replication?.encrypt;
  const decryptEntryFn: DecryptFn | undefined =
    encryption?.replication?.decrypt;
  const encryptPayloadFn: EncryptFn | undefined = encryption?.data?.encrypt;
  const decryptPayloadFn: DecryptFn | undefined = encryption?.data?.decrypt;

  const _entries: StorageBackend = entryStorage || (await DefaultStorage());
  const _index: StorageBackend = indexStorage || (await DefaultStorage());
  headsStorage = headsStorage || (await DefaultStorage());

  const headsArray: string[] | undefined = logHeads
    ?.map((h) => (typeof h === "string" ? h : h.hash))
    .filter((h): h is string => !!h);

  const _heads = await Heads({
    storage: headsStorage,
    heads: headsArray,
    decryptPayloadFn,
    decryptEntryFn,
  } as HeadsOptions);

  const get = async (hash: string): Promise<EntryType | undefined> => {
    const bytes = await _entries.get(hash);
    if (!bytes) return undefined;
    return Entry.decode(bytes as Uint8Array, decryptEntryFn, decryptPayloadFn);
  };

  const getBytes = async (hash: string): Promise<Uint8Array | undefined> => {
    const bytes = await _entries.get(hash);
    return bytes as Uint8Array | undefined;
  };

  const has = async (hash: string): Promise<boolean> =>
    (await _index.get(hash)) != null;

  const heads = async (): Promise<EntryType[]> => {
    const heads_: EntryType[] = [];
    for (const { hash } of await _heads.all()) {
      if (!hash) continue; // skip undefined hashes
      const head = await get(hash);
      if (head) heads_.push(head);
    }
    return heads_;
  };

  const setHead = async (entry: EntryType): Promise<string> => {
    const { hash, bytes } = await Entry.encode(
      entry,
      encryptEntryFn,
      encryptPayloadFn
    );

    if (!hash) throw new Error("Entry encoding failed: hash is undefined");

    await _entries.put(hash, bytes);
    await _index.put(hash, true);
    await _heads.set([entry]); // pass full EntryType

    return hash;
  };

  const addHead = async (entry: EntryType): Promise<string> => {
    await _heads.add(entry);

    if (!entry.hash) throw new Error("Entry hash is undefined");
    return entry.hash;
  };

  const removeHeads = async (hashes: string[]): Promise<void> => {
    for (const hash of hashes) await _heads.remove(hash);
  };

  const addVerified = async (hashes: string[]): Promise<void> => {
    for (const hash of hashes) {
      await _index.put(hash, true);
      if ("persist" in _entries && typeof _entries.persist === "function") {
        await _entries.persist(hash);
      }
    }
  };

  const clear = async (): Promise<void> => {
    await _index.clear();
    await _heads.clear();
    await _entries.clear();
  };

  const close = async (): Promise<void> => {
    await _index.close();
    await _heads.close();
    await _entries.close();
  };

  return {
    get,
    getBytes,
    has,
    heads,
    setHead,
    addHead,
    removeHeads,
    addVerified,
    storage: _entries,
    clear,
    close,
  };
};

export default OplogStore;

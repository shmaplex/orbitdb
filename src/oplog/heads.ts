/**
 * @namespace module:Log~Heads
 * @memberof module:Log
 * @description The log's heads.
 * @private
 */

import type { StorageBackend } from "../storage";
import MemoryStorage from "../storage/memory";
import Entry, { type EntryType } from "./entry";

/** Heads options type */
export interface HeadsOptions {
  storage?: StorageBackend;
  heads?: EntryType[];
  decryptPayloadFn?: (payload: Uint8Array) => Promise<unknown>;
  decryptEntryFn?: (bytes: Uint8Array) => Promise<unknown>;
}

/** Heads instance interface */
export interface HeadsInstance {
  put(heads: EntryType[]): Promise<void>;
  set(heads: EntryType[]): Promise<void>;
  add(head: EntryType): Promise<EntryType[] | undefined>;
  remove(hash: string): Promise<void>;
  iterator(): AsyncGenerator<EntryType>;
  all(): Promise<EntryType[]>;
  clear(): Promise<void>;
  close(): Promise<void>;
}

/** Default storage type */
const DefaultStorage = MemoryStorage;

/** Creates a Heads instance */
const Heads = async ({
  storage,
  heads,
  decryptPayloadFn,
  decryptEntryFn,
}: HeadsOptions = {}): Promise<HeadsInstance> => {
  const storageInstance: StorageBackend = storage || (await DefaultStorage());

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  /** Puts heads into storage */
  const put = async (inputHeads: EntryType[]): Promise<void> => {
    const resolvedHeads = findHeads(inputHeads);
    const newHeads = resolvedHeads.map((e) => ({
      hash: e.hash ?? "",
      next: e.next,
    }));
    const bytes = encoder.encode(JSON.stringify(newHeads));
    await storageInstance.put("heads", bytes);
  };

  /** Adds a new head if it doesn't already exist */
  const add = async (head: EntryType): Promise<EntryType[] | undefined> => {
    const currentHeads = await all();
    if (currentHeads.find((e) => Entry.isEqual(e, head))) {
      return;
    }
    const newHeads = findHeads([...currentHeads, head]);
    await put(newHeads);
    return newHeads;
  };

  /** Removes a head by hash */
  const remove = async (hash: string): Promise<void> => {
    const currentHeads = await all();
    const newHeads = currentHeads.filter((e) => e.hash !== hash);
    await put(newHeads);
  };

  /** Iterates over stored heads */
  const iterator = async function* (): AsyncGenerator<EntryType> {
    const bytes = await storageInstance.get("heads");
    const headHashes: { hash: string; next: string[] }[] = bytes
      ? JSON.parse(decoder.decode(bytes))
      : [];

    for (const h of headHashes) {
      // Yield as EntryType via unknown cast, because Entry is not constructable
      yield {
        hash: h.hash,
        next: h.next,
        payload: undefined,
        refs: [],
        clock: undefined,
        v: 0,
        key: "",
        identity: "",
        sig: "",
        id: "", // satisfy required EntryType fields
      } as unknown as EntryType;
    }
  };

  /** Returns all heads as an array */
  const all = async (): Promise<EntryType[]> => {
    const values: EntryType[] = [];
    for await (const head of iterator()) {
      values.push(head);
    }
    return values;
  };

  /** Clears the heads storage */
  const clear = async (): Promise<void> => {
    await storageInstance.clear();
  };

  /** Closes the heads storage */
  const close = async (): Promise<void> => {
    await storageInstance.close();
  };

  // Initialize the heads if provided
  if (heads) {
    await put(heads);
  }

  return {
    put,
    set: put,
    add,
    remove,
    iterator,
    all,
    clear,
    close,
  };
};

/** Private helper: find heads from a collection of entries */
const findHeads = (entries: EntryType[]): EntryType[] => {
  const entrySet = new Set(entries);
  const referenced: Record<string, string> = {};

  for (const entry of entrySet) {
    if (!entry.hash) continue;

    // handle possibly undefined 'next'
    for (const next of entry.next ?? []) {
      if (next) referenced[next] = entry.hash;
    }
  }

  const res: EntryType[] = [];
  for (const entry of entrySet) {
    if (!entry.hash) continue;
    if (!referenced[entry.hash]) {
      res.push(entry);
    }
  }

  return res;
};

export default Heads;

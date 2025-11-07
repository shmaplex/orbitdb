import { LRUCache } from "lru-cache";
import type { StorageBackend } from ".";

const defaultSize = 1_000_000;

/**
 * LRUStorage implements StorageBackend using an LRU cache.
 */
export interface LRUStorage extends StorageBackend {}

const LRUStorage = async ({
  size = defaultSize,
}: { size?: number } = {}): Promise<LRUStorage> => {
  const lru = new LRUCache<string, Uint8Array>({ max: size });

  const put = async (
    hash: string,
    data: Uint8Array | unknown
  ): Promise<void> => {
    if (!(data instanceof Uint8Array)) {
      throw new Error("LRUStorage only supports Uint8Array values");
    }
    lru.set(hash, data);
  };

  const del = async (hash: string): Promise<void> => {
    lru.delete(hash);
  };

  const get = async (hash: string): Promise<Uint8Array | undefined> => {
    return lru.get(hash);
  };

  const iterator = async function* (): AsyncGenerator<[string, Uint8Array]> {
    for (const key of lru.keys()) {
      const value = lru.get(key);
      if (value) yield [key, value];
    }
  };

  const merge = async (other: StorageBackend): Promise<void> => {
    for await (const [key, value] of other.iterator()) {
      if (!(value instanceof Uint8Array)) {
        throw new Error(`Cannot merge non-Uint8Array value for key ${key}`);
      }
      lru.set(key, value);
    }
  };

  const clear = async (): Promise<void> => lru.clear();

  const close = async (): Promise<void> => {};

  return { put, del, get, iterator, merge, clear, close };
};

export default LRUStorage;

// src/storage/composed.ts
import type { StorageBackend } from ".";

/**
 * @namespace Storage-Composed
 * @memberof module:Storage
 * @description
 * ComposedStorage stores data to multiple storage backends.
 * It propagates operations like `put`, `get`, `del`, and `merge` across multiple backends.
 */
export interface ComposedStorageInstance extends StorageBackend {}

/**
 * Creates an instance of ComposedStorage that combines multiple storage backends.
 *
 * @param {...StorageBackend[]} storages - One or more storage backends to compose.
 * @returns {Promise<ComposedStorageInstance>} A composed storage instance implementing `StorageBackend`.
 */
const ComposedStorage = async (
  ...storages: StorageBackend[]
): Promise<ComposedStorageInstance> => {
  /**
   * Puts a value into all storage backends.
   */
  const put = async (hash: string, data: Uint8Array | unknown) => {
    await Promise.all(storages.map((s) => s.put(hash, data)));
  };

  /**
   * Retrieves a value from the composed storage.
   * Checks each storage backend in order. Updates previous backends if found later.
   */
  const get = async (hash: string): Promise<Uint8Array | undefined> => {
    let value: Uint8Array | undefined;

    for (let i = 0; i < storages.length; i++) {
      const storage = storages[i];
      const v = await storage.get(hash);
      if (v instanceof Uint8Array) {
        value = v;
        // update all previous storages
        for (let j = 0; j < i; j++) {
          await storages[j].put(hash, value);
        }
        break;
      }
    }

    return value;
  };

  /**
   * Deletes a value from all storage backends.
   */
  const del = async (hash: string) => {
    await Promise.all(storages.map((s) => s.del?.(hash)));
  };

  /**
   * Async iterator over unique key/value pairs from all storage backends.
   */
  const iterator = async function* ({
    amount,
    reverse,
  }: { amount?: number; reverse?: boolean } = {}): AsyncGenerator<
    [string, Uint8Array | unknown]
  > {
    const seen = new Set<string>();

    for (const storage of storages) {
      if (!storage.iterator) continue;

      for await (const [key, value] of storage.iterator({
        amount: amount ?? -1,
        reverse: reverse ?? false,
      })) {
        if (!seen.has(key)) {
          seen.add(key);
          yield [key, value];
        }
      }
    }
  };

  /**
   * Merge another storage backend into all composed backends.
   */
  const merge = async (other: StorageBackend) => {
    await Promise.all(storages.map((s) => s.merge?.(other)));
  };

  /**
   * Clear all data from all storage backends.
   */
  const clear = async () => {
    await Promise.all(storages.map((s) => s.clear?.()));
  };

  /**
   * Optionally persist a key in all storage backends.
   */
  const persist = async (hash?: string) => {
    await Promise.all(storages.map((s) => s.persist?.(hash)));
  };

  /**
   * Close all storage backends.
   */
  const close = async () => {
    await Promise.all(storages.map((s) => s.close?.()));
  };

  return { put, get, del, iterator, merge, clear, persist, close };
};

export default ComposedStorage;

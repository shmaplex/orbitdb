/**
 * @namespace Storage-Memory
 * @memberof module:Storage
 * @description
 * MemoryStorage stores data in memory.
 */
import type { StorageBackend } from ".";

export interface MemoryStorage extends StorageBackend {}

/**
 * Creates an in-memory storage backend.
 */
const MemoryStorage = async (): Promise<MemoryStorage> => {
  let memory: Record<string, Uint8Array> = {};

  const put = async (
    hash: string,
    data: Uint8Array | unknown
  ): Promise<void> => {
    // Ensure only Uint8Array is stored
    if (data instanceof Uint8Array) {
      memory[hash] = data;
    } else {
      throw new Error(
        `MemoryStorage only supports Uint8Array values. Got: ${typeof data}`
      );
    }
  };

  const del = async (hash: string): Promise<void> => {
    delete memory[hash];
  };

  const get = async (hash: string): Promise<Uint8Array | undefined> => {
    return memory[hash];
  };

  const iterator = async function* (): AsyncGenerator<[string, Uint8Array]> {
    for (const [key, value] of Object.entries(memory)) {
      yield [key, value];
    }
  };

  const merge = async (other: StorageBackend): Promise<void> => {
    for await (const [key, value] of other.iterator()) {
      if (value instanceof Uint8Array) {
        memory[key] = value;
      } else {
        throw new Error(`Cannot merge non-Uint8Array value for key ${key}`);
      }
    }
  };

  const clear = async (): Promise<void> => {
    memory = {};
  };

  const close = async (): Promise<void> => {};

  return { put, del, get, iterator, merge, clear, close };
};

export default MemoryStorage;

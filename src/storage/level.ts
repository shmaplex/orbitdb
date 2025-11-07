import { Level } from "level";
import type { StorageBackend } from ".";

/** Default LevelDB path */
const defaultPath = "./level";

/** Default encoding for values */
const defaultValueEncoding = "view";

/**
 * Interface for a LevelStorage instance compatible with StorageBackend.
 */
export interface LevelStorageInstance extends StorageBackend {}

/**
 * Creates a LevelStorage instance.
 *
 * @param {object} [options]
 * @param {string} [options.path=./level] - Path to the LevelDB database.
 * @param {string} [options.valueEncoding='view'] - LevelDB value encoding.
 * @returns {Promise<LevelStorageInstance>} A storage backend implementing StorageBackend.
 */
const LevelStorage = async ({
  path = defaultPath,
  valueEncoding = defaultValueEncoding,
}: {
  path?: string;
  valueEncoding?: string;
} = {}): Promise<LevelStorageInstance> => {
  const db = new Level<string, Uint8Array>(path, { valueEncoding });
  await db.open();

  /**
   * Stores a value under a given key.
   * @param {string} hash - The key.
   * @param {Uint8Array} value - The value to store.
   */
  const put = async (
    hash: string,
    value: Uint8Array | unknown
  ): Promise<void> => {
    if (!(value instanceof Uint8Array)) {
      throw new Error("LevelStorage only supports Uint8Array values");
    }
    await db.put(hash, value);
  };

  /**
   * Deletes a key/value pair.
   * @param {string} hash - The key to delete.
   */
  const del = async (hash: string): Promise<void> => {
    await db.del(hash);
  };

  /**
   * Retrieves a value by key.
   * @param {string} hash - The key to retrieve.
   * @returns {Promise<Uint8Array | undefined>} The stored value or undefined if missing.
   */
  const get = async (hash: string): Promise<Uint8Array | undefined> => {
    try {
      return await db.get(hash);
    } catch {
      return undefined;
    }
  };

  /**
   * Iterates over stored entries.
   * @param {object} [options] - Optional iteration settings.
   * @param {number} [options.amount] - Maximum number of entries.
   * @param {boolean} [options.reverse] - Whether to iterate in reverse order.
   */
  const iterator = async function* ({
    amount = -1,
    reverse = false,
  }: { amount?: number; reverse?: boolean } = {}): AsyncGenerator<
    [string, Uint8Array]
  > {
    for await (const [key, value] of db.iterator({ limit: amount, reverse })) {
      yield [key, value];
    }
  };

  /**
   * Merges another storage backend into this LevelStorage instance.
   *
   * @param {StorageBackend} other - The other storage backend to merge from.
   */
  const merge = async (other: StorageBackend): Promise<void> => {
    if (!other?.iterator) return;

    try {
      for await (const [key, value] of other.iterator()) {
        if (value instanceof Uint8Array) await db.put(key, value);
        else if (value !== undefined && value !== null) {
          console.warn(`Skipping key ${key}: value is not Uint8Array`);
        }
      }
    } catch (err) {
      console.error("Error during merge operation:", err);
    }
  };

  /**
   * Clears all entries from the database.
   */
  const clear = async (): Promise<void> => {
    await db.clear();
  };

  /**
   * Closes the LevelDB database.
   */
  const close = async (): Promise<void> => {
    await db.close();
  };

  return { put, del, get, iterator, merge, clear, close };
};

export default LevelStorage;

/**
 * @module Storage
 * @description
 * Storage backends for OrbitDB.
 */

import ComposedStorage from "./composed";
import IPFSBlockStorage from "./ipfs-block";
import LevelStorage from "./level";
import LRUStorage from "./lru";
import MemoryStorage from "./memory";

/**
 * ComposedStorage stores data to multiple storage backends.
 */
export { ComposedStorage };

/**
 * IPFSBlockStorage uses IPFS to store data as raw blocks.
 */
export { IPFSBlockStorage };

/**
 * LevelStorage stores data to a Level-compatible database.
 */
export { LevelStorage };

/**
 * LRUStorage stores data in a Least Recently Used cache.
 */
export { LRUStorage };

/**
 * MemoryStorage stores data in memory.
 */
export { MemoryStorage };

/**
 * Optional default export if you want a single namespace object
 * but keep it fully typed.
 */
const Storage = {
  ComposedStorage,
  IPFSBlockStorage,
  LevelStorage,
  LRUStorage,
  MemoryStorage,
};

export default Storage;

/**
 * Type-safe helper for default export (optional)
 */
export type StorageConstructors = {
  ComposedStorage: (...storages: StorageBackend[]) => Promise<StorageBackend>;
  IPFSBlockStorage: (options: {
    ipfs: any;
    pin?: boolean;
    timeout?: number;
  }) => Promise<StorageBackend>;
  LevelStorage: (options?: {
    path?: string;
    valueEncoding?: string;
  }) => Promise<StorageBackend>;
  LRUStorage: (options?: { size?: number }) => Promise<StorageBackend>;
  MemoryStorage: () => Promise<StorageBackend>;
};

/**
 * Base interface for storage backends.
 * - `get` returns Uint8Array | undefined for type-safe decoding.
 * - `put` accepts Uint8Array or any serializable data.
 */
export interface StorageBackend {
  /**
   * Store a value at the given hash key.
   * Typically, the value is serialized (e.g., block bytes).
   */
  put(hash: string, data: Uint8Array | unknown): Promise<void>;

  /**
   * Delete a value by hash key.
   */
  del(hash: string): Promise<void>;

  /**
   * Retrieve stored bytes by hash.
   * Must return Uint8Array or undefined for proper decoding.
   */
  get(hash: string): Promise<Uint8Array | undefined>;

  /**
   * Async iterator over stored entries.
   * Optionally limit amount or reverse order.
   */
  iterator(options?: {
    amount?: number;
    reverse?: boolean;
  }): AsyncGenerator<[string, Uint8Array | unknown]>;

  /**
   * Merge another storage backend into this one.
   */
  merge(other: StorageBackend): Promise<void>;

  /**
   * Clear all stored entries.
   */
  clear(): Promise<void>;

  /**
   * Persist a single entry or all entries.
   */
  persist?(hash?: string): Promise<void>;

  /**
   * Close storage and release any resources.
   */
  close(): Promise<void>;
}

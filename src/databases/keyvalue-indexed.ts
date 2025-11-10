// src/databases/keyvalue-indexed.ts
import type { IPFS } from "ipfs-core-types";
import type { DatabaseContext, DatabaseInstance } from "../database";
import pathJoin from "../utils/path-join";
import type { DatabaseType } from ".";
import { Index, type IndexedEntry } from "./indexed";
import KeyValue from "./keyvalue";

const type = "keyvalue-indexed";

/**
 * KeyValueIndexed Instance Interface
 */
export interface KeyValueIndexedInstance extends DatabaseInstance {
  type: string;
  get: (key: string) => Promise<any>;
  iterator: (filters?: {
    amount?: number;
    reverse?: boolean;
  }) => AsyncGenerator<[string, IndexedEntry]>;
  close: () => Promise<void>;
  drop: () => Promise<void>;
  update?: (log: any, entry: any) => Promise<void>;
}

/**
 * KeyValueIndexed Context
 */
export interface KeyValueIndexedContext extends DatabaseContext {
  ipfs: IPFS;
  identity?: any;
  address: string;
  name?: string;
}

/**
 * Factory: KeyValueIndexed Database
 */
const KeyValueIndexed: DatabaseType =
  () =>
  async (context: KeyValueIndexedContext): Promise<KeyValueIndexedInstance> => {
    const { directory, address } = context;

    // Construct the index directory path safely
    const finalDirectory = pathJoin(
      directory || "./orbitdb",
      `./${address}/_index/`
    );

    // Create the index and key-value store
    const index = await Index({ directory: finalDirectory })();
    const keyValueStore = await KeyValue()({
      ...context,
      onUpdate: index.update, // replaces the user's onUpdate
    });

    // Define standard methods
    const get = async (key: string) => {
      const entry = await index.get(key);
      return entry?.payload.value;
    };

    const iterator = async function* ({
      amount,
      reverse,
    }: { amount?: number; reverse?: boolean } = {}): AsyncGenerator<
      [string, IndexedEntry]
    > {
      const it = index.iterator({ amount, reverse });
      for await (const record of it) {
        if (Array.isArray(record) && record.length === 2) {
          const [key, entry] = record as [string, IndexedEntry];
          yield [entry.payload.key, entry];
        }
      }
    };

    const close = async () => {
      await keyValueStore.close();
      await index.close();
    };

    const drop = async () => {
      await keyValueStore.drop();
      await index.drop();
    };

    // Avoid DOM "name" deprecation by explicitly assigning from context/database
    const dbName = keyValueStore.name || context.name || "keyvalue-indexed";

    return {
      ...keyValueStore,
      get,
      iterator,
      close,
      drop,
      address,
      name: dbName,
      type,
      events: keyValueStore.events,
      update: index.update,
    };
  };

KeyValueIndexed.type = type;

export default KeyValueIndexed;

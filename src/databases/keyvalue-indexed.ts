// src/databases/keyvalue-indexed.ts
import type { Helia } from "helia";
import type { DatabaseContext, DatabaseType } from "../database";
import pathJoin from "../utils/path-join";
import { Index, type IndexedEntry } from "./indexed";
import KeyValue, { type KeyValueInstance } from "./keyvalue";

const type = "keyvalue-indexed";

/**
 * KeyValueIndexed Instance Interface
 */
export interface KeyValueIndexedInstance extends KeyValueInstance {
  iterator: (filters?: {
    amount?: number;
    reverse?: boolean;
  }) => AsyncGenerator<{ key: string; value: any; hash: string }>;
  update?: (log: any, entry: any) => Promise<void>;
}

/**
 * KeyValueIndexed Context (Helia-specific)
 */
export interface KeyValueIndexedContext extends Omit<DatabaseContext, "ipfs"> {
  ipfs: Helia;
  identity?: any;
  address: string;
  name?: string;
}

/**
 * Factory: KeyValueIndexed Database
 *
 * Note: We keep the generic DatabaseType parameter as DatabaseContext so it’s compatible,
 * but internally we assert that context is KeyValueIndexedContext.
 */
const KeyValueIndexed: DatabaseType<KeyValueIndexedInstance> =
  () =>
  async (context: DatabaseContext): Promise<KeyValueIndexedInstance> => {
    // Assert context is Helia-based
    const { directory, address } = context as KeyValueIndexedContext;

    // Construct the index directory path safely
    const finalDirectory = pathJoin(
      directory || "./orbitdb",
      `./${address}/_index/`
    );

    // Create the index and key-value store
    const index = await Index({ directory: finalDirectory })();
    const keyValueStore = await KeyValue()({
      ...context,
      onUpdate: index.update as DatabaseContext["onUpdate"],
    });

    // Define standard methods
    const get = async (key: string) => {
      const entry = await index.get(key);
      return entry?.payload.value;
    };

    const iterator = async function* ({
      amount,
      reverse,
    }: { amount?: number; reverse?: boolean } = {}): AsyncGenerator<{
      key: string;
      value: any;
      hash: string;
    }> {
      for await (const record of index.iterator({ amount, reverse })) {
        const entry = record[1] as IndexedEntry;
        yield {
          key: entry.payload.key,
          value: entry.payload.value,
          hash: entry.hash,
        };
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

    // Name fallback
    const dbName =
      keyValueStore.name ||
      (context as KeyValueIndexedContext).name ||
      "keyvalue-indexed";

    // Return the KeyValueIndexedInstance
    return {
      ...keyValueStore, // includes put, del, all, events, etc.
      get,
      iterator,
      close,
      drop,
      address,
      name: dbName,
      type,
      update: index.update,
    };
  };

KeyValueIndexed.type = type;

export default KeyValueIndexed;

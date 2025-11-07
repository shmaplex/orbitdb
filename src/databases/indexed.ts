// src/databases/indexed.ts
import LevelStorage from "../storage/level";
import pathJoin from "../utils/path-join";

// Value Encoding
const valueEncoding = "json";

// Indexed Entry Interface
interface IndexedEntry {
  payload: {
    op: "PUT" | "DEL";
    key: string;
    value: any;
  };
  hash: string;
  next?: string[];
}

// Index Interface
interface IndexInstance {
  get: (key: string) => Promise<IndexedEntry | undefined>;
  iterator: (filters?: {
    amount?: number;
    reverse?: boolean;
  }) => AsyncGenerator<[string, IndexedEntry]>;
  update: (log: any, entry: IndexedEntry) => Promise<void>;
  close: () => Promise<void>;
  drop: () => Promise<void>;
}

/**
 * Creates an Index for a KeyValue database.
 * @param directory Optional directory path for storage.
 * @returns IndexInstance
 */
const Index =
  ({
    directory,
  }: { directory?: string } = {}): (() => Promise<IndexInstance>) =>
  async (): Promise<IndexInstance> => {
    const indexStorage = await LevelStorage({ path: directory, valueEncoding });
    const indexedEntries = await LevelStorage({
      path: pathJoin(directory || "", "/_indexedEntries/"),
      valueEncoding,
    });

    const update = async (log: any, entry: IndexedEntry) => {
      const keys = new Set<string>();
      const toBeIndexed = new Set<string>();
      const latest = entry.hash;

      const isIndexed = async (hash: string): Promise<boolean> => {
        try {
          const result = await indexedEntries.get(hash);
          return result !== undefined && result !== null;
        } catch {
          return false;
        }
      };

      const isNotIndexed = async (hash: string): Promise<boolean> => {
        return !(await isIndexed(hash));
      };

      const shouldStopTraverse = async (
        entry: IndexedEntry
      ): Promise<boolean> => {
        for await (const hash of entry.next || []) {
          if (await isNotIndexed(hash)) toBeIndexed.add(hash);
        }
        return (await isIndexed(latest)) && toBeIndexed.size === 0;
      };

      for await (const e of log.traverse(null, shouldStopTraverse)) {
        const { hash, payload } = e as IndexedEntry;
        if (await isNotIndexed(hash)) {
          const { op, key } = payload;
          if (op === "PUT" && !keys.has(key)) {
            keys.add(key);
            await indexStorage.put(key, e);
            await indexedEntries.put(hash, true);
          } else if (op === "DEL" && !keys.has(key)) {
            keys.add(key);
            await indexStorage.del(key);
            await indexedEntries.put(hash, true);
          }
          toBeIndexed.delete(hash);
        }
      }
    };

    const get = async (key: string): Promise<IndexedEntry | undefined> => {
      try {
        const value = await indexStorage.get(key);
        if (value === undefined || value === null) return undefined;

        // If the value is already an IndexedEntry, return it
        if (
          typeof value === "object" &&
          "hash" in value &&
          "payload" in value
        ) {
          return value as IndexedEntry;
        }

        // Otherwise, construct an IndexedEntry
        return {
          hash: key,
          payload: { op: "PUT", key, value },
        };
      } catch {
        return undefined;
      }
    };

    const iterator = async function* ({
      amount,
      reverse,
    }: { amount?: number; reverse?: boolean } = {}): AsyncGenerator<
      [string, IndexedEntry]
    > {
      const it = indexStorage.iterator({ amount, reverse });
      for await (const record of it) {
        if (Array.isArray(record) && record.length === 2) {
          const key = record[0] as string;
          const value = record[1];

          // If value is already an IndexedEntry, use it
          if (
            typeof value === "object" &&
            value !== null &&
            "hash" in value &&
            "payload" in value
          ) {
            yield [key, value as IndexedEntry];
          } else {
            // Otherwise, construct an IndexedEntry
            yield [
              key,
              {
                hash: key,
                payload: { op: "PUT", key, value },
              },
            ];
          }
        }
      }
    };

    const close = async (): Promise<void> => {
      await indexStorage.close();
      await indexedEntries.close();
    };

    const drop = async (): Promise<void> => {
      await indexStorage.clear();
      await indexedEntries.clear();
    };

    return { get, iterator, update, close, drop };
  };

export { Index, type IndexedEntry, type IndexInstance };

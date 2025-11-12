import LevelStorage from "../storage/level";
import pathJoin from "../utils/path-join";

/** Value encoding for LevelDB storage */
const valueEncoding = "json";

/** Indexed entry structure stored in the index */
export interface IndexedEntry {
  payload: {
    op: "PUT" | "DEL";
    key: string;
    value: any;
  };
  hash: string;
  next?: string[];
}

/** Public interface for an Index instance */
export interface IndexInstance {
  get: (key: string) => Promise<IndexedEntry | undefined>;
  iterator: (filters?: {
    amount?: number;
    reverse?: boolean;
  }) => AsyncGenerator<[string, IndexedEntry], void, unknown>;
  update: (log: any, entry: IndexedEntry) => Promise<void>;
  close: () => Promise<void>;
  drop: () => Promise<void>;
}

/**
 * Creates a persistent index for KeyValue databases.
 * Tracks and updates entries via log traversal.
 */
const Index =
  ({ directory }: { directory?: string } = {}) =>
  async (): Promise<IndexInstance> => {
    const indexStorage = await LevelStorage({
      path: directory,
      valueEncoding,
    });

    const indexedEntries = await LevelStorage({
      path: pathJoin(directory || "", "/_indexedEntries/"),
      valueEncoding,
    });

    /**
     * Updates the index when new entries are added to the log.
     */
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

      const isNotIndexed = async (hash: string): Promise<boolean> =>
        !(await isIndexed(hash));

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

    /**
     * Retrieves an entry from the index by key.
     */
    const get = async (key: string): Promise<IndexedEntry | undefined> => {
      try {
        const value = await indexStorage.get(key);
        if (value === undefined || value === null) return undefined;

        if (
          typeof value === "object" &&
          "hash" in value &&
          "payload" in value
        ) {
          return value as IndexedEntry;
        }

        return { hash: key, payload: { op: "PUT", key, value } };
      } catch {
        return undefined;
      }
    };

    /**
     * Iterates over all indexed entries.
     * Always yields a [key, IndexedEntry] tuple.
     */
    const iterator = async function* ({
      amount,
      reverse,
    }: { amount?: number; reverse?: boolean } = {}): AsyncGenerator<
      [string, IndexedEntry],
      void,
      unknown
    > {
      const it = indexStorage.iterator({ amount, reverse });

      for await (const record of it) {
        if (!Array.isArray(record) || record.length < 2) continue;
        const [key, value] = record as [string, any];

        const entry: IndexedEntry =
          typeof value === "object" &&
          value !== null &&
          "hash" in value &&
          "payload" in value
            ? (value as IndexedEntry)
            : { hash: key, payload: { op: "PUT", key, value } };

        yield [key, entry];
      }
    };

    /**
     * Closes index databases.
     */
    const close = async (): Promise<void> => {
      await indexStorage.close();
      await indexedEntries.close();
    };

    /**
     * Drops all data in the index.
     */
    const drop = async (): Promise<void> => {
      await indexStorage.clear();
      await indexedEntries.clear();
    };

    return { get, iterator, update, close, drop };
  };

export { Index };

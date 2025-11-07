import Database, { type DatabaseContext } from "../database";
import type { DatabaseInstance, DatabaseType } from ".";

const type = "keyvalue";

export interface KeyValueEntry {
  payload: { op: "PUT" | "DEL"; key: string; value: any };
  hash: string;
}

export interface KeyValueInstance extends DatabaseInstance {
  put: (key: string, value: any) => Promise<string>;
  del: (key: string) => Promise<string>;
  get: (key: string) => Promise<any>;
  iterator: (filters?: {
    amount?: number;
  }) => AsyncGenerator<{ key: string; value: any; hash: string }>;
  all: () => Promise<Array<{ key: string; value: any; hash: string }>>;
}

const KeyValue: DatabaseType<KeyValueInstance> =
  () =>
  async (context: DatabaseContext): Promise<KeyValueInstance> => {
    const database = await Database(context);

    if (!database.name) {
      throw new Error("Database name is required for KeyValue instances");
    }

    const { addOperation, log } = database;

    const put = (key: string, value: any) =>
      addOperation({ op: "PUT", key, value });
    const del = (key: string) => addOperation({ op: "DEL", key, value: null });

    const get = async (key: string) => {
      for await (const entry of log.traverse()) {
        const { op, key: k, value } = (entry as KeyValueEntry).payload;
        if (k === key) {
          if (op === "PUT") return value;
          if (op === "DEL") return;
        }
      }
    };

    const iterator = async function* ({ amount }: { amount?: number } = {}) {
      const seen: Record<string, boolean> = {};
      let count = 0;
      for await (const entry of log.traverse()) {
        const { op, key, value } = (entry as KeyValueEntry).payload;
        if (!seen[key]) {
          if (op === "PUT") {
            seen[key] = true;
            yield { key, value, hash: entry.hash ?? "" }; // ✅ Fix here
            if (amount && ++count >= amount) break;
          } else if (op === "DEL") {
            seen[key] = true;
          }
        }
      }
    };

    const all = async () => {
      const items: Array<{ key: string; value: any; hash: string }> = [];
      for await (const entry of iterator()) items.unshift(entry);
      return items;
    };

    return { ...database, type, put, del, get, iterator, all };
  };

KeyValue.type = type;

export default KeyValue;

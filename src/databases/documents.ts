import type {
  DatabaseContext,
  DatabaseInstance,
  DatabaseType,
} from "../database";
import Database from "../database";

const type = "documents";

export interface DocumentEntry<T = any> {
  hash: string;
  key: string;
  value: T;
}

export interface DocumentsOptions {
  indexBy?: string;
}

export interface DocumentsInstance<T = any> extends DatabaseInstance {
  type: string;
  indexBy: string;
  put: (doc: T) => Promise<string>;
  del: (key: string) => Promise<string>;
  get: (key: string) => Promise<DocumentEntry<T> | undefined>;
  iterator: (filters?: { amount?: number }) => AsyncGenerator<DocumentEntry<T>>;
  query: (fn: (doc: T) => boolean) => Promise<T[]>;
  all: () => Promise<DocumentEntry<T>[]>;
}

export interface LogPayload<T = any> {
  op: "PUT" | "DEL";
  key: string;
  value: T | null;
}

// Fully compatible with DatabaseType
const Documents: DatabaseType =
  (options: DocumentsOptions = { indexBy: "_id" }) =>
  async (context: DatabaseContext): Promise<DocumentsInstance> => {
    const database = await Database(context);

    if (!database.name) {
      throw new Error("Database name is required for Documents instances");
    }

    const { addOperation, log, close, address: dbAddress } = database;

    const put = async <T extends Record<string, any>>(
      doc: T
    ): Promise<string> => {
      const key = doc[options.indexBy || "_id"];
      if (!key) throw new Error(`Document missing field '${options.indexBy}'`);
      return addOperation({ op: "PUT", key, value: doc });
    };

    const del = async (key: string): Promise<string> => {
      if (!(await get(key))) throw new Error(`No document with key '${key}'`);
      return addOperation({ op: "DEL", key, value: null });
    };

    const iterator = async function* <T = any>({
      amount,
    }: { amount?: number } = {}): AsyncGenerator<DocumentEntry<T>> {
      const keys: Record<string, boolean> = {};
      let count = 0;
      for await (const entry of log.iterator()) {
        const payload = entry.payload as LogPayload<T>;
        const { op, key, value } = payload;
        if (!entry.hash) continue;
        if (op === "PUT" && !keys[key]) {
          keys[key] = true;
          count++;
          yield { hash: entry.hash, key, value: value as T };
        } else if (op === "DEL" && !keys[key]) {
          keys[key] = true;
        }
        if (amount && count >= amount) break;
      }
    };

    const get = async <T = any>(
      key: string
    ): Promise<DocumentEntry<T> | undefined> => {
      for await (const doc of iterator<T>()) {
        if (doc.key === key) return doc;
      }
    };

    const query = async <T = any>(fn: (doc: T) => boolean): Promise<T[]> => {
      const results: T[] = [];
      for await (const doc of iterator<T>()) {
        if (fn(doc.value)) results.push(doc.value);
      }
      return results;
    };

    const all = async <T = any>(): Promise<DocumentEntry<T>[]> => {
      const values: DocumentEntry<T>[] = [];
      for await (const entry of iterator<T>()) values.unshift(entry);
      return values;
    };

    return {
      ...database,
      type,
      name: database.name || context.name || "documents",
      address: dbAddress,
      close,
      indexBy: options.indexBy || "_id",
      put,
      del,
      get,
      iterator,
      query,
      all,
    } as DocumentsInstance;
  };

Documents.type = type;

export default Documents;

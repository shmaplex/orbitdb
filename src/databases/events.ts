import type { IPFS } from "ipfs-core-types";
import Database, {
  type DatabaseInstance,
  DatabaseType,
  type Encryption,
} from "../database";
import type { IdentitiesInstance } from "../identities";

const type = "events";

/**
 * Context required to create an Events database instance.
 */
export interface EventsContext {
  ipfs: IPFS;
  identity?: IdentitiesInstance;
  address: string;
  name?: string;
  access?: any;
  directory?: string;
  meta?: Record<string, any>;
  headsStorage?: any;
  entryStorage?: any;
  indexStorage?: any;
  referencesCount?: number;
  syncAutomatically?: boolean;
  onUpdate?: (value: any) => void;
  encryption?:
    | {
        encryptFn?: (data: Uint8Array) => Uint8Array | Promise<Uint8Array>;
        decryptFn?: (data: Uint8Array) => Uint8Array | Promise<Uint8Array>;
      }
    | boolean
    | undefined;
}

/**
 * An entry in the Events log.
 */
export interface EventEntry<T = any> {
  hash: string;
  value: T;
}

export interface EventPayload<T = any> {
  op: string;
  key?: string | null;
  value: T;
}

/**
 * Live Events database instance.
 */
export interface EventsInstance<T = any> extends DatabaseInstance {
  type: string;
  name: string;
  add: (value: T) => Promise<string>;
  get: (hash: string) => Promise<T | undefined>;
  iterator: (filters?: {
    gt?: string;
    gte?: string;
    lt?: string;
    lte?: string;
    amount?: number;
  }) => AsyncGenerator<EventEntry<T>>;
  all: () => Promise<EventEntry<T>[]>;
}

/**
 * Normalize encryption for Database
 */
function normalizeEncryption(
  encryption: EventsContext["encryption"]
): Encryption | undefined {
  if (!encryption) return undefined;
  if (typeof encryption === "boolean") return undefined;
  return encryption as Encryption;
}

/**
 * Factory to create an Events database instance (curried style).
 */
const Events: DatabaseType =
  () =>
  async (context: EventsContext): Promise<EventsInstance> => {
    if (!context.address) throw new Error("Database address is required");

    const dbEncryption: Encryption | undefined = normalizeEncryption(
      context.encryption
    );

    const database = await Database({
      ...context,
      encryption: dbEncryption,
    });

    const add = async <T = any>(value: T) =>
      database.addOperation({ op: "ADD", key: "__dummy__", value });

    const get = async <T = any>(hash: string) => {
      const entry = await database.log.get(hash);
      if (!entry?.hash) return undefined;
      const payload = entry.payload as EventPayload<T>;
      return payload.value;
    };

    const iterator = async function* <T = any>({
      gt,
      gte,
      lt,
      lte,
      amount,
    }: {
      gt?: string;
      gte?: string;
      lt?: string;
      lte?: string;
      amount?: number;
    } = {}): AsyncGenerator<EventEntry<T>> {
      for await (const event of database.log.iterator({
        gt,
        gte,
        lt,
        lte,
        amount,
      })) {
        const payload = event.payload as EventPayload<T>;
        if (!event.hash) continue;
        yield { hash: event.hash, value: payload.value };
      }
    };

    const all = async <T = any>(): Promise<EventEntry<T>[]> => {
      const entries: EventEntry<T>[] = [];
      for await (const e of iterator<T>()) entries.unshift(e);
      return entries;
    };

    return {
      ...database,
      type,
      name: database.name || context.name || "events",
      add,
      get,
      iterator,
      all,
    };
  };

Events.type = type;

export default Events;

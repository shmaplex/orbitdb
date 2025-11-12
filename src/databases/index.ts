/**
 * @module Databases
 * @description
 * Provides various database structures for storing data.
 */
import type { DatabaseType } from "../database";
import Documents from "./documents";
import Events from "./events";
import KeyValue from "./keyvalue";
import KeyValueIndexed from "./keyvalue-indexed";

/** Dictionary of database types keyed by `type` */
const databaseTypes: Record<string, DatabaseType> = {};

/**
 * Registers a new database type.
 */
const useDatabaseType = (database: DatabaseType): void => {
  if (!database.type) {
    throw new Error("Database type does not contain required field 'type'.");
  }
  databaseTypes[database.type] = database;
};

/**
 * Retrieves a database module by type and returns it.
 *
 * Technically returns the curried factory, but typed as DatabaseInstance for TS compatibility.
 */
const getDatabaseType = (type: string): DatabaseType => {
  if (!type) throw new Error("Type not specified");
  const dbFactory = databaseTypes[type];
  if (!dbFactory) throw new Error(`Unsupported database type: '${type}'`);
  return dbFactory;
};

// Register default database types
useDatabaseType(Events);
useDatabaseType(Documents);
useDatabaseType(KeyValue);
useDatabaseType(KeyValueIndexed);

export {
  useDatabaseType,
  getDatabaseType,
  Documents,
  Events,
  KeyValue,
  KeyValueIndexed,
};
export type {
  DocumentEntry,
  DocumentsInstance,
  DocumentsOptions,
} from "./documents";
export type { EventEntry, EventsContext, EventsInstance } from "./events";
export type { IndexedEntry, IndexInstance } from "./indexed";
export type { KeyValueEntry, KeyValueInstance } from "./keyvalue";
export type {
  KeyValueIndexedContext,
  KeyValueIndexedInstance,
} from "./keyvalue-indexed";

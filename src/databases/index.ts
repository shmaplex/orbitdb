/**
 * @module Databases
 * @description
 * Provides various database structures for storing data.
 */

import type { EventEmitter } from "node:stream";
import type { DatabaseInstance as GeneralDatabaseInstance } from "../database";
import Documents from "./documents";
import Events from "./events";
import KeyValue from "./keyvalue";
import KeyValueIndexed from "./keyvalue-indexed";

/** Base interface for any live database instance */
export interface DatabaseInstance extends GeneralDatabaseInstance {
  address: string;
  name?: string;
  type: string;
  events: EventEmitter;
}

/** Curried database module type (the factory) */
export interface DatabaseType {
  type: string;
  (options?: any): (context?: any) => Promise<DatabaseInstance>;
}

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

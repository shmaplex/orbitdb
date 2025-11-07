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

  // Now events is fully compatible with EventEmitter
  events: EventEmitter;
}

/** Generic database module interface (curried style) */
export interface DatabaseType<
  Inst extends DatabaseInstance = DatabaseInstance,
  Options = any,
  Ctx = any
> {
  type: string;
  (options?: Options): (context: Ctx) => Promise<Inst>;
}

/** Dictionary of database types keyed by `type` */
export const databaseTypes: Record<string, DatabaseType> = {};

/**
 * Registers a new database type.
 * @param database A Database module with a `type` field.
 */
export const useDatabaseType = <
  Inst extends DatabaseInstance,
  Options = any,
  Ctx = any
>(
  database: DatabaseType<Inst, Options, Ctx>
): void => {
  if (!database.type) {
    throw new Error("Database type does not contain required field 'type'.");
  }
  if (databaseTypes[database.type]) {
    throw new Error(`Database type '${database.type}' already added.`);
  }
  databaseTypes[database.type] = database as DatabaseType;
};

/**
 * Retrieves a database module by type.
 */
export const getDatabaseType = <
  Inst extends DatabaseInstance,
  Options = any,
  Ctx = any
>(
  type: string
): DatabaseType<Inst, Options, Ctx> => {
  if (!type) throw new Error("Type not specified");
  const dbType = databaseTypes[type];
  if (!dbType) throw new Error(`Unsupported database type: '${type}'`);
  return dbType as DatabaseType<Inst, Options, Ctx>;
};

// Register default database types
useDatabaseType(Events);
useDatabaseType(Documents);
useDatabaseType(KeyValue);
useDatabaseType(KeyValueIndexed);

export { Documents, Events, KeyValue, KeyValueIndexed };

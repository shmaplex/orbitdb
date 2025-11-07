// src/oplog/index.ts
/**
 * @module Oplog
 * @description
 * Core exports for the OrbitDB log system:
 * - `Log` for managing the append-only log
 * - `Entry` for individual log entries
 * - `Clock` for Lamport clocks and causal ordering
 * - `ConflictResolution` for conflict resolution strategies
 * - `DefaultAccessController` for default log access control
 */

import Clock, { type ClockType } from "./clock";
import ConflictResolution, {
  type ConflictResolutionType,
} from "./conflict-resolution";
import Entry, { type Entry as EntryType } from "./entry";
import Log, { DefaultAccessController, type LogInstance } from "./log";

/**
 * Type exports for external use
 */
export type {
  EntryType,
  ClockType,
  LogInstance as LogType,
  DefaultAccessController as DefaultAccessControllerType,
  ConflictResolutionType,
};

/**
 * Core log system exports
 */
export { Log, DefaultAccessController, Entry, Clock, ConflictResolution };

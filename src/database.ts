/**
 * @module Database
 * @description
 * Database is the base class for OrbitDB data stores and handles lower-level
 * add operations and database syncing using IPFS.
 */

import { EventEmitter } from "node:events";
import type { IPFS } from "ipfs-core-types";
import PQueue from "p-queue";
import type { OrbitDBAccessControllerInstance } from "./access-controllers";
import type { IdentitiesInstance } from "./identities/identities";
import { type EntryType, Log, type LogType } from "./oplog";
import type { StorageBackend } from "./storage";
import {
  ComposedStorage,
  IPFSBlockStorage,
  LevelStorage,
  LRUStorage,
} from "./storage";
import Sync, { type SyncInstance } from "./sync";
import pathJoin from "./utils/path-join";

// ---- Defaults ----
const defaultReferencesCount = 16;
const defaultCacheSize = 1000;

// ---- Types ----
export interface Encryption {
  data?: {
    encrypt?: (data: Uint8Array) => Promise<Uint8Array>;
    decrypt?: (data: Uint8Array) => Promise<Uint8Array>;
  };
}

export type AccessControllerInput =
  | OrbitDBAccessControllerInstance
  | (() => Promise<OrbitDBAccessControllerInstance>);

/** Context for database operations */
export interface DatabaseContext<TUpdate = any> {
  ipfs: IPFS;
  identity?: IdentitiesInstance;
  address: string;
  name?: string; // Keep optional here
  access?: any;
  directory?: string;
  meta?: Record<string, any>;
  headsStorage?: StorageBackend;
  entryStorage?: StorageBackend;
  indexStorage?: StorageBackend;
  referencesCount?: number;
  syncAutomatically?: boolean;
  onUpdate?: (log: LogType, entry: EntryType) => void; // Fix: 2 parameters
  encryption?: Encryption;
}

export interface DatabaseInstance {
  address: string;
  name?: string; // Keep optional here since it might not be provided
  identity?: IdentitiesInstance;
  meta: Record<string, any>;
  close: () => Promise<void>;
  drop: () => Promise<void>;
  addOperation: (op: unknown) => Promise<string>;
  log: LogType;
  sync: SyncInstance;
  peers: Set<string>;
  events: EventEmitter;
  access?: OrbitDBAccessControllerInstance;
}

// ---- Database Implementation ----
const Database = async ({
  ipfs,
  identity,
  address,
  name,
  access,
  directory,
  meta,
  headsStorage,
  entryStorage,
  indexStorage,
  referencesCount,
  syncAutomatically,
  onUpdate,
  encryption,
}: DatabaseContext): Promise<DatabaseInstance> => {
  directory = pathJoin(directory || "./orbitdb", `./${address}/`);
  meta = meta || {};
  const refCount = referencesCount ?? defaultReferencesCount;

  // --- Setup storage backends ---
  entryStorage =
    entryStorage ||
    (await ComposedStorage(
      await LRUStorage({ size: defaultCacheSize }),
      await IPFSBlockStorage({ ipfs, pin: true })
    ));

  headsStorage =
    headsStorage ||
    (await ComposedStorage(
      await LRUStorage({ size: defaultCacheSize }),
      await LevelStorage({ path: pathJoin(directory, "/log/_heads/") })
    ));

  indexStorage =
    indexStorage ||
    (await ComposedStorage(
      await LRUStorage({ size: defaultCacheSize }),
      await LevelStorage({ path: pathJoin(directory, "/log/_index/") })
    ));

  // --- Resolve access controller if factory ---
  let resolvedAccess: OrbitDBAccessControllerInstance | undefined;
  if (typeof access === "function") {
    resolvedAccess = await access();
  } else {
    resolvedAccess = access;
  }

  // --- Initialize the log ---
  const log: LogType = await Log(identity, {
    logId: address,
    access: resolvedAccess,
    entryStorage,
    headsStorage,
    indexStorage,
    encryption,
  });

  const events = new EventEmitter();
  const queue = new PQueue({ concurrency: 1 });

  // --- Add operation to log ---
  const addOperation = async (op: unknown): Promise<string> => {
    const task = async () => {
      const entry = await log.append(op, { referencesCount: refCount });
      await sync.add(entry);
      if (onUpdate) await onUpdate(log, entry);
      events.emit("update", entry);

      if (!entry.hash) {
        throw new Error("Entry hash is undefined after append"); // safeguard
      }

      return entry.hash; // now TypeScript knows this is a string
    };
    return queue.add(task);
  };

  // --- Apply external operation (during sync) ---
  const applyOperation = async (entry: EntryType): Promise<void> => {
    const task = async () => {
      try {
        if (entry) {
          const updated = await log.joinEntry(entry);
          if (updated) {
            if (onUpdate) await onUpdate(log, entry);
            events.emit("update", entry);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    await queue.add(task);
  };

  // --- Initialize sync ---
  const sync: SyncInstance = await Sync({
    ipfs,
    log,
    events,
    onSynced: applyOperation,
    start: syncAutomatically,
  });

  // --- Close database ---
  const close = async (): Promise<void> => {
    await sync.stop();
    await queue.onIdle();
    await log.close();
    if (resolvedAccess?.close) await resolvedAccess.close();
    events.emit("close");
  };

  // --- Drop database ---
  const drop = async (): Promise<void> => {
    await queue.clear();
    await log.clear();
    if (resolvedAccess?.drop) await resolvedAccess.drop();
    events.emit("drop");
  };

  return {
    address,
    name,
    identity,
    meta,
    close,
    drop,
    addOperation,
    log,
    sync,
    peers: sync.peers,
    events,
    access: resolvedAccess,
  };
};

export default Database;

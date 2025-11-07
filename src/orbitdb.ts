import type { IPFS } from "ipfs-core-types";
import {
  type AccessControllerInstance as ACInstance,
  getAccessController,
  useAccessController,
} from "./access-controllers";
import IPFSAccessController from "./access-controllers/ipfs";
import OrbitDBAccessController from "./access-controllers/orbitdb";
import OrbitDBAddress, { isValidAddress } from "./address";
import type { DatabaseInstance, DatabaseType } from "./databases";
import { getDatabaseType } from "./databases";
import {
  Identities,
  type IdentitiesInstance,
  type IdentityProvider,
} from "./identities";
import type { IdentityOptions } from "./identities/identities";
import type { IdentityType } from "./identities/identity";
import KeyStore, { type KeyStoreInstance } from "./key-store";
import ManifestStore, {
  type ManifestParams,
  type ManifestStoreInstance,
} from "./manifest-store";
import { createId, join as pathJoin } from "./utils";

const DEFAULT_DB_TYPE = "events";

// Wrap default access controller as factory
const DEFAULT_ACCESS_CONTROLLER = async (ctx: Record<string, any>) =>
  IPFSAccessController(ctx);

// Register built-in controllers
useAccessController(IPFSAccessController);
useAccessController(OrbitDBAccessController);

export interface OpenDatabaseOptions {
  type?: string;
  meta?: Record<string, unknown>;
  sync?: boolean;
  Database?: DatabaseType;
  AccessController?: AccessControllerModuleFactory;
  headsStorage?: any;
  entryStorage?: any;
  indexStorage?: any;
  referencesCount?: number;
  encryption?: boolean;
}

export interface OrbitDBInstance {
  id: string;
  open(
    address: string,
    params?: OpenDatabaseOptions
  ): Promise<DatabaseInstance>;
  stop(): Promise<void>;
  ipfs: IPFS;
  directory: string;
  keystore: KeyStoreInstance;
  identities: IdentitiesInstance;
  identity: IdentityType;
  peerId: unknown;
}

export type AccessControllerModuleFactory = (
  context: Record<string, any>
) => Promise<ACInstance>;

const OrbitDB = async ({
  ipfs,
  id,
  identity,
  identities,
  directory,
}: {
  ipfs: IPFS;
  id?: string;
  identity?: Partial<IdentityType> & { provider?: unknown };
  identities?: IdentitiesInstance;
  directory?: string;
}): Promise<OrbitDBInstance> => {
  if (!ipfs) throw new Error("IPFS instance is required");

  const peerId = (ipfs as any).libp2p?.peerId;
  const dbId = id || (await createId());
  const dir = directory || "./orbitdb";

  const ks: KeyStoreInstance =
    identities?.keystore ||
    (await KeyStore({ path: pathJoin(dir, "keystore") }));

  const ids: IdentitiesInstance =
    identities || (await Identities({ ipfs, keystore: ks }));

  // Build IdentityOptions safely
  const identityOpts: IdentityOptions = {};
  if (identity) {
    if (identity.provider) {
      identityOpts.provider = identity.provider as IdentityProvider;
    }
    if (identity.id) {
      identityOpts.id = identity.id;
    }
  }

  const userIdentity: IdentityType = await ids.createIdentity(
    Object.keys(identityOpts).length > 0 ? identityOpts : { id: dbId }
  );

  const manifestStore: ManifestStoreInstance = await ManifestStore({ ipfs });
  const databases: Record<string, DatabaseInstance> = {};

  const handleDatabaseClose = (address: string) => () => {
    delete databases[address];
  };

  const open = async (
    address: string,
    options: OpenDatabaseOptions = {}
  ): Promise<DatabaseInstance> => {
    if (databases[address]) return databases[address];

    const {
      type: optType,
      meta,
      sync = true,
      Database: optDatabase,
      AccessController: optAC,
      headsStorage,
      entryStorage,
      indexStorage,
      referencesCount,
      encryption,
    } = options;

    const dbAddress = address;
    const dbTypeLocal = optType || DEFAULT_DB_TYPE;

    let manifest: Record<string, any>;
    let accessController: ACInstance;
    let name: string;

    if (isValidAddress(dbAddress)) {
      const addr = OrbitDBAddress(dbAddress);
      manifest = (await manifestStore.get(addr.hash)) || {};
      const acType = manifest.accessController?.split("/").pop();

      const acModule = acType
        ? getAccessController(acType)
        : DEFAULT_ACCESS_CONTROLLER;
      const acFactory: AccessControllerModuleFactory =
        typeof acModule === "function"
          ? (acModule as AccessControllerModuleFactory)
          : async () => acModule as ACInstance;

      accessController = await acFactory({
        orbitdb: { open, identity: userIdentity, ipfs },
        identities: ids,
        address: manifest.accessController,
      });

      name = manifest.name;
    } else {
      const acFactory: AccessControllerModuleFactory =
        optAC || DEFAULT_ACCESS_CONTROLLER;

      accessController = await acFactory({
        orbitdb: { open, identity: userIdentity, ipfs },
        identities: ids,
        name: dbAddress,
      });

      const m = await manifestStore.create({
        name: dbAddress,
        type: dbTypeLocal,
        accessController: accessController.address,
        meta,
      } as ManifestParams);

      manifest = m.manifest;
      name = manifest.name;
    }

    const dbFactory = optDatabase || getDatabaseType(dbTypeLocal);
    const db = await dbFactory()({
      ipfs,
      identity: userIdentity,
      address: dbAddress,
      name,
      access: accessController,
      directory: dir,
      meta,
      syncAutomatically: sync,
      headsStorage,
      entryStorage,
      indexStorage,
      referencesCount,
      encryption,
    });

    db.events.on("close", handleDatabaseClose(dbAddress));
    databases[dbAddress] = db;

    return db;
  };

  const stop = async (): Promise<void> => {
    for (const db of Object.values(databases)) await db.close();
    await ks.close();
    await manifestStore.close();
    for (const k of Object.keys(databases)) delete databases[k];
  };

  return {
    id: dbId,
    open,
    stop,
    ipfs,
    directory: dir,
    keystore: ks,
    identities: ids,
    identity: userIdentity,
    peerId,
  };
};

export { OrbitDB as default, OrbitDBAddress };

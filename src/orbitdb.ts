import type { IPFS } from "ipfs-core-types";
import {
  type AccessControllerInstance as ACInstance,
  getAccessController,
  useAccessController,
} from "./access-controllers";
import IPFSAccessController from "./access-controllers/ipfs";
import OrbitDBAccessController from "./access-controllers/orbitdb";
import OrbitDBAddress, {
  isValidAddress,
  type OrbitDBAddressType,
} from "./address";
import type { DatabaseInstance, DatabaseType } from "./database";
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
import type { StorageBackend } from "./storage";
import { createId, join as pathJoin } from "./utils";

const DEFAULT_DB_TYPE = "events";
const DEFAULT_ACCESS_CONTROLLER = IPFSAccessController;

useAccessController(IPFSAccessController);
useAccessController(OrbitDBAccessController);

export interface OpenDatabaseOptions {
  type?: string;
  meta?: Record<string, unknown>;
  sync?: boolean;
  Database?: DatabaseType;
  AccessController?: () => (ctx: any) => Promise<ACInstance>;
  headsStorage?: StorageBackend;
  entryStorage?: StorageBackend;
  indexStorage?: StorageBackend;
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

  const identityOpts: IdentityOptions = {};
  if (identity) {
    if (identity.provider)
      identityOpts.provider = identity.provider as IdentityProvider;
    if (identity.id) identityOpts.id = identity.id;
  }

  const userIdentity: IdentityType = await ids.createIdentity(
    Object.keys(identityOpts).length > 0 ? identityOpts : { id: dbId }
  );

  const manifestStore: ManifestStoreInstance = await ManifestStore({ ipfs });
  const databases: Record<string, DatabaseInstance> = {};

  const onDatabaseClosed = (address: string) => () => delete databases[address];

  const open = async (
    inputAddress: string,
    options: OpenDatabaseOptions = {}
  ): Promise<DatabaseInstance> => {
    if (databases[inputAddress]) return databases[inputAddress];

    const {
      type: optType,
      meta: optMeta,
      sync = true,
      Database: optDatabase,
      AccessController: optAC,
      headsStorage,
      entryStorage,
      indexStorage,
      referencesCount,
      encryption,
    } = options;

    let address: OrbitDBAddressType = OrbitDBAddress(inputAddress);
    let type = optType || DEFAULT_DB_TYPE;
    let meta = optMeta;
    let manifest: Record<string, any>;
    let accessController: ACInstance;
    let name: string;

    if (isValidAddress(inputAddress)) {
      const addr = OrbitDBAddress(inputAddress);
      manifest = (await manifestStore.get(addr.hash)) || {};

      const acType = manifest.accessController?.split("/").pop();
      if (!acType)
        throw new Error("Invalid access controller type in manifest");

      const ACModule = getAccessController(acType);
      const ACFactory = ACModule(); // outer factory
      accessController = await ACFactory({
        orbitdb: { open, identity: userIdentity, ipfs },
        identities: ids,
        address: manifest.accessController,
      });

      name = manifest.name;
      type = type || manifest.type;
      meta = manifest.meta;
    } else {
      const ACModule = optAC || DEFAULT_ACCESS_CONTROLLER;
      const ACFactory = ACModule(); // outer factory
      accessController = await ACFactory({
        orbitdb: { open, identity: userIdentity, ipfs },
        identities: ids,
        name: inputAddress,
      });

      const m = await manifestStore.create({
        name: inputAddress,
        type,
        accessController: accessController.address,
        meta,
      } as ManifestParams);

      manifest = m.manifest;
      address = OrbitDBAddress(m.hash);
      name = manifest.name;
      meta = manifest.meta;

      if (databases[inputAddress]) return databases[inputAddress];
    }

    const dbFactory = optDatabase || getDatabaseType(type)();
    if (!dbFactory) throw new Error(`Unsupported database type: '${type}'`);

    const db = (await dbFactory({
      ipfs,
      identity: userIdentity,
      address: address.toString(),
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
    })) as DatabaseInstance;

    db.events.on("close", onDatabaseClosed(inputAddress));
    databases[inputAddress] = db;

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

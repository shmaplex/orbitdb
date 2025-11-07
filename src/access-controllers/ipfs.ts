/**
 * @namespace AccessControllers-IPFS
 * @memberof module:AccessControllers
 * @description
 * Provides an IPFS-based Access Controller. Supports creating and
 * verifying write permissions for log entries. Can be used as a
 * factory function in OrbitDB or other AccessController systems.
 */

import * as dagCbor from "@ipld/dag-cbor";
import { base58btc } from "multiformats/bases/base58";
import * as Block from "multiformats/block";
import { sha256 } from "multiformats/hashes/sha2";
import type { LogEntry } from "../oplog/log";
import type { StorageBackend } from "../storage";
import { ComposedStorage, IPFSBlockStorage, LRUStorage } from "../storage";
import { join as pathJoin } from "../utils";
import type { AccessControllerInstance, AccessControllerModule } from ".";

const codec = dagCbor;
const hasher = sha256;
const hashStringEncoding = base58btc;

const type = "ipfs";

interface AccessControlListParams {
  storage: StorageBackend;
  type: string;
  params: Record<string, any>;
}

const AccessControlList = async ({
  storage,
  type,
  params,
}: AccessControlListParams): Promise<string> => {
  const manifest = { type, ...params };
  const { cid, bytes } = await Block.encode({ value: manifest, codec, hasher });
  const hash = cid.toString(hashStringEncoding);
  await storage.put(hash, bytes);
  return hash;
};

export interface IPFSAccessControllerContext {
  orbitdb: { ipfs: any; identity: { id: string } };
  identities: {
    getIdentity: (id: string) => Promise<{ id: string } | undefined>;
    verifyIdentity: (identity: { id: string }) => Promise<boolean>;
  };
  address?: string;
  write?: string[];
  storage?: StorageBackend;
}

const IPFSAccessController: AccessControllerModule = Object.assign(
  async ({
    orbitdb,
    identities,
    address,
    write,
    storage,
  }: IPFSAccessControllerContext): Promise<AccessControllerInstance> => {
    const composedStorage: StorageBackend =
      storage ||
      (await ComposedStorage(
        await LRUStorage({ size: 1000 }),
        await IPFSBlockStorage({ ipfs: orbitdb.ipfs, pin: true })
      ));

    let allowedWriters = write || [orbitdb.identity.id];

    if (address) {
      const key = address.replace(/^\/ipfs\//, "");
      const manifestBytes = await composedStorage.get(key);
      if (!(manifestBytes instanceof Uint8Array)) {
        throw new Error(`Expected Uint8Array from storage at key ${key}`);
      }

      const decoded = await Block.decode<{ write?: string[] }, number, number>({
        bytes: manifestBytes,
        codec,
        hasher,
      });

      allowedWriters = Array.isArray(decoded.value.write)
        ? decoded.value.write
        : allowedWriters;
    } else {
      address = await AccessControlList({
        storage: composedStorage,
        type,
        params: { write: allowedWriters },
      });
      address = pathJoin("/", type, address);
    }

    // Only expose canAppend, as required by AccessControllerInstance
    const canAppend = async (entry: LogEntry): Promise<boolean> => {
      const writerIdentity = await identities.getIdentity(entry.identity);
      if (!writerIdentity) return false;

      const { id } = writerIdentity;
      if (allowedWriters.includes(id) || allowedWriters.includes("*")) {
        return identities.verifyIdentity(writerIdentity);
      }
      return false;
    };

    return { canAppend };
  },
  { type }
);

export default IPFSAccessController;

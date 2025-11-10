// src/access-controllers/ipfs.ts
import * as dagCbor from "@ipld/dag-cbor";
import { base58btc } from "multiformats/bases/base58";
import * as Block from "multiformats/block";
import { sha256 } from "multiformats/hashes/sha2";
import type { EntryType } from "../oplog";
import { ComposedStorage, IPFSBlockStorage, LRUStorage } from "../storage";
import { join as pathJoin } from "../utils";
import type {
  AccessControllerContext,
  AccessControllerModule,
  AccessControllerParams,
} from ".";

const codec = dagCbor;
const hasher = sha256;
const hashStringEncoding = base58btc;
const type = "ipfs";

/** Encode manifest into storage */
const AccessControlList = async ({
  storage,
  type,
  params,
}: {
  storage: any;
  type: string;
  params: Record<string, any>;
}): Promise<string> => {
  const manifest = { type, ...params };
  const { cid, bytes } = await Block.encode({ value: manifest, codec, hasher });
  const hash = cid.toString(hashStringEncoding);
  await storage.put(hash, bytes);
  return hash;
};

/**
 * IPFSAccessController
 * Can be used as:
 *   1. Curried factory: IPFSAccessController({ write?, storage? })({ orbitdb, identities, address })
 *   2. Single-stage async: await IPFSAccessController({ orbitdb, identities, address, write?, storage? })
 */
const IPFSAccessController: AccessControllerModule = Object.assign(
  (params: AccessControllerParams = {}) =>
    async (ctx: AccessControllerContext & AccessControllerParams) => {
      // Merge params and ctx
      const {
        write: pWrite,
        storage: pStorage,
        ...restCtx
      } = { ...params, ...ctx };
      const { orbitdb, identities } = restCtx;
      let { write, storage, address } = {
        write: pWrite,
        storage: pStorage,
        address: restCtx.address,
      };

      storage =
        storage ||
        (await ComposedStorage(
          await LRUStorage({ size: 1000 }),
          await IPFSBlockStorage({ ipfs: orbitdb.ipfs, pin: true })
        ));

      const allowedWriters = write || [orbitdb.identity.id];

      if (address) {
        const key = address.replace(/^\/ipfs\//, "");
        const manifestBytes = await storage.get(key);
        if (!(manifestBytes instanceof Uint8Array)) {
          throw new Error(`Expected Uint8Array from storage at key ${key}`);
        }
        const decoded = await Block.decode<
          { write?: string[] },
          number,
          number
        >({
          bytes: manifestBytes,
          codec,
          hasher,
        });
        write = Array.isArray(decoded.value.write)
          ? decoded.value.write
          : allowedWriters;
      } else {
        address = await AccessControlList({
          storage,
          type,
          params: { write: allowedWriters },
        });
        address = pathJoin("/", type, address);
      }

      const canAppend = async (entry: EntryType): Promise<boolean> => {
        const writerIdentity = await identities.getIdentity(entry.identity);
        if (!writerIdentity) return false;
        const { id } = writerIdentity;
        if (allowedWriters.includes(id) || allowedWriters.includes("*")) {
          return identities.verifyIdentity(writerIdentity);
        }
        return false;
      };

      return {
        type,
        write: allowedWriters,
        address,
        canAppend,
      };
    },
  { type }
);

export default IPFSAccessController;

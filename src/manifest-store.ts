/**
 * @module Manifest
 * @description Manifest storage for OrbitDB.
 */

import * as dagCbor from "@ipld/dag-cbor";
import type { IPFS } from "ipfs-core-types";
import { base58btc } from "multiformats/bases/base58";
import * as Block from "multiformats/block";
import { sha256 } from "multiformats/hashes/sha2";
import {
  type AccessControllerType,
  getAccessController,
} from "./access-controllers";
import type { StorageBackend } from "./storage";
import { ComposedStorage, IPFSBlockStorage, LRUStorage } from "./storage";
import { decodeBlock } from "./utils/decode-block";

const codec = dagCbor;
const hasher = sha256;
const hashStringEncoding = base58btc;

export interface ManifestParams {
  name: string;
  type: string;
  accessController: AccessControllerType;
  meta?: any;
}

export interface ManifestStoreInstance {
  get(address: string): Promise<Record<string, any> | undefined>;
  create(
    params: ManifestParams
  ): Promise<{ hash: string; manifest: Record<string, any> }>;
  close(): Promise<void>;
}

/**
 * Creates a ManifestStore instance.
 * @param params - ManifestStore configuration
 */
const ManifestStore = async ({
  ipfs,
  storage,
}: {
  ipfs?: IPFS;
  storage?: StorageBackend;
} = {}): Promise<ManifestStoreInstance> => {
  const backendStorage =
    storage ??
    (ipfs
      ? await ComposedStorage(
          await LRUStorage({ size: 100_000 }),
          await IPFSBlockStorage({ ipfs, pin: true })
        )
      : undefined);

  if (!backendStorage) {
    throw new Error(
      "Either a storage backend or an IPFS instance must be provided."
    );
  }

  const get = async (
    address: string
  ): Promise<Record<string, any> | undefined> => {
    const bytes = await backendStorage.get(address);
    if (!bytes) return undefined;

    // decode the block bytes using the helper
    const value = await decodeBlock<Record<string, any>>(bytes);

    if (value && typeof value === "object") {
      // optional caching: re-store bytes
      await backendStorage.put(address, bytes);
      return value;
    }

    return undefined;
  };

  const create = async ({
    name,
    type,
    accessController,
    meta,
  }: ManifestParams): Promise<{
    hash: string;
    manifest: Record<string, any>;
  }> => {
    if (!name) throw new Error("name is required");
    if (!type) throw new Error("type is required");
    if (!accessController) throw new Error("accessController is required");

    // Validate access controller
    getAccessController(accessController);

    const manifest: Record<string, any> = Object.assign(
      { name, type, accessController },
      meta !== undefined ? { meta } : {}
    );

    const { cid, bytes } = await Block.encode({
      value: manifest,
      codec,
      hasher,
    });
    const hash = cid.toString(hashStringEncoding);
    await backendStorage.put(hash, bytes);

    return { hash, manifest };
  };

  const close = async (): Promise<void> => {
    await backendStorage.close();
  };

  return { get, create, close };
};

export default ManifestStore;

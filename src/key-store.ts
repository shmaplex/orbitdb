// src/key-store.ts
/**
 * @module KeyStore
 * @description
 * Provides a fully-typed local key manager for OrbitDB using pluggable storage backends.
 */

import {
  generateKeyPair,
  privateKeyFromRaw,
  publicKeyFromRaw,
} from "@libp2p/crypto/keys";
import type { PrivateKey, PublicKey } from "@libp2p/interface";
import { compare as uint8ArrayCompare } from "uint8arrays/compare";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";
import { toString as uint8ArrayToString } from "uint8arrays/to-string";
import type { StorageBackend } from "./storage";
import ComposedStorage from "./storage/composed";
import LevelStorage from "./storage/level";
import LRUStorage from "./storage/lru";

/**
 * Cached verified message structure
 */
type VerifiedCacheItem = {
  publicKey: string;
  data: Uint8Array | string;
};

// Cached verified messages using an LRU storage backend
const verifiedCachePromise: Promise<StorageBackend> = LRUStorage({
  size: 1000,
});

/**
 * Verify a signature against input data and a public key
 * @param signature - Hex-encoded signature
 * @param publicKey - Hex-encoded public key
 * @param data - Raw input data as string or Uint8Array
 * @returns `true` if the signature is valid
 */
export const verifySignature = async (
  signature: string,
  publicKey: string,
  data: string | Uint8Array
): Promise<boolean> => {
  const buf = data instanceof Uint8Array ? data : uint8ArrayFromString(data);

  try {
    const pubKey: PublicKey = publicKeyFromRaw(
      uint8ArrayFromString(publicKey, "base16")
    );
    return await pubKey.verify(buf, uint8ArrayFromString(signature, "base16"));
  } catch {
    return false;
  }
};

/**
 * Sign input data with a private key
 * @param key - PrivateKey instance
 * @param data - Raw input data as string or Uint8Array
 * @returns Hex-encoded signature
 */
export const signMessage = async (
  key: PrivateKey,
  data: string | Uint8Array
): Promise<string> => {
  if (!key) throw new Error("No signing key given");
  if (data === undefined) throw new Error("Given input data was undefined");
  const buf = data instanceof Uint8Array ? data : uint8ArrayFromString(data);
  const sig = await key.sign(buf);
  return uint8ArrayToString(sig, "base16");
};

/**
 * Verify a signed message against a cached version of previously verified messages
 * @param signature - Hex-encoded signature
 * @param publicKey - Hex-encoded public key
 * @param data - Raw input data
 */
export const verifyMessage = async (
  signature: string,
  publicKey: string,
  data: string | Uint8Array
): Promise<boolean> => {
  if (!signature) throw new Error("Signature required");
  if (!publicKey) throw new Error("Public key required");
  if (data === undefined) throw new Error("Data required");
  const verifiedCache = await verifiedCachePromise;
  const cached = (await verifiedCache.get(signature)) as
    | VerifiedCacheItem
    | undefined;

  if (!cached) {
    const verified = await verifySignature(signature, publicKey, data);
    if (verified) await verifiedCache.put(signature, { publicKey, data });
    return verified;
  }

  const cachedData = cached.data;
  const match =
    data instanceof Uint8Array
      ? uint8ArrayCompare(cachedData as Uint8Array, data) === 0
      : cachedData.toString() === data.toString();

  return cached.publicKey === publicKey && match;
};

// Default path for key storage
const defaultPath = "./keystore";

/**
 * KeyStore constructor options
 */
export interface KeyStoreOptions {
  storage?: StorageBackend;
  path?: string;
}

/**
 * KeyStore instance interface
 */
export interface KeyStoreInstance {
  clear: () => Promise<void>;
  close: () => Promise<void>;
  hasKey: (id: string) => Promise<boolean>;
  addKey: (id: string, key: { privateKey: Uint8Array }) => Promise<void>;
  createKey: (id: string) => Promise<PrivateKey>;
  getKey: (id: string) => Promise<PrivateKey | undefined>;
  getPublic: (
    key: PrivateKey,
    format?: "hex" | "buffer"
  ) => string | Uint8Array;
}

/**
 * Creates a KeyStore instance
 */
const KeyStore = async ({
  storage,
  path,
}: KeyStoreOptions = {}): Promise<KeyStoreInstance> => {
  const resolvedStorage: StorageBackend =
    storage ||
    (await ComposedStorage(
      await LRUStorage({ size: 1000 }),
      await LevelStorage({ path: path || defaultPath })
    ));

  // Cache for private keys
  const keyCache: StorageBackend = await LRUStorage({ size: 1000 });

  /**
   * Closes the KeyStore's underlying storage.
   */
  const close = async () => {
    await resolvedStorage.close();
    await keyCache.close();
  };

  /**
   * Clears the KeyStore's underlying storage.
   */
  const clear = async () => {
    await resolvedStorage.clear();
    await keyCache.clear();
  };

  /**
   * Checks if a key exists in the key store .
   */
  const hasKey = async (id: string) => {
    if (await keyCache.get(id)) return true;
    try {
      const stored = await resolvedStorage.get(`private_${id}`);
      return !!stored;
    } catch {
      return false;
    }
  };

  /**
   * Adds a private key to the keystore.
   */
  const addKey = async (id: string, key: { privateKey: Uint8Array }) => {
    await resolvedStorage.put(`private_${id}`, key.privateKey);
    const unmarshaledKey = privateKeyFromRaw(key.privateKey);
    await keyCache.put(id, unmarshaledKey);
  };

  /**
   * Creates a key pair and stores it to the keystore.
   */
  const createKey = async (id: string) => {
    if (!id) {
      throw new Error("id needed to create a key");
    }
    const key: PrivateKey = await generateKeyPair("secp256k1");
    await addKey(id, { privateKey: key.raw });
    return key;
  };

  /**
   * Gets a key from keystore.
   */
  const getKey = async (id: string) => {
    let key: PrivateKey | undefined = (await keyCache.get(id)) as
      | PrivateKey
      | undefined;
    if (!key) {
      const storedKey: Uint8Array | undefined = await resolvedStorage.get(
        `private_${id}`
      );
      if (!storedKey) return undefined;
      key = privateKeyFromRaw(storedKey);
      await keyCache.put(id, key);
    }
    return key;
  };

  /**
   * Gets the serialized public key from a key pair.
   */
  const getPublic = (key: PrivateKey, format: "hex" | "buffer" = "hex") => {
    const pubKey = key.publicKey.raw;
    return format === "hex" ? uint8ArrayToString(pubKey, "base16") : pubKey;
  };

  return { clear, close, hasKey, addKey, createKey, getKey, getPublic };
};

export type KeyStoreType = KeyStoreInstance;
export default KeyStore;

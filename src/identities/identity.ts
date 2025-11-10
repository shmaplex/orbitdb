import * as dagCbor from "@ipld/dag-cbor";
import { base58btc } from "multiformats/bases/base58";
import * as Block from "multiformats/block";
import { sha256 } from "multiformats/hashes/sha2";

const codec = dagCbor;
const hasher = sha256;
const hashStringEncoding = base58btc;

/**
 * Represents a full Identity object.
 */
export interface IdentityType {
  id: string;
  publicKey: { raw: string; [key: string]: unknown };
  signatures: { id: unknown; publicKey: unknown; [key: string]: unknown };
  type: string;
  sign: (data: Uint8Array) => Promise<Uint8Array>;
  verify: (data: Uint8Array, signature: Uint8Array) => Promise<boolean>;
  hash?: string;
  bytes?: Uint8Array;
}

/**
 * Minimal serializable Identity used for IPLD encoding/decoding.
 */
interface IdentitySerializable {
  id: string;
  publicKey: { raw: string; [key: string]: unknown };
  signatures: { id: unknown; publicKey: unknown; [key: string]: unknown };
  type: string;
}

type IdentityInput = Partial<{
  id: string;
  publicKey: string | { raw: string; [key: string]: unknown };
  signatures: { id?: unknown; publicKey?: unknown; [key: string]: unknown };
  type: string;
  sign: (data: Uint8Array) => Promise<Uint8Array>;
  verify: (data: Uint8Array, signature: Uint8Array) => Promise<boolean>;
}>;

/**
 * Creates a new Identity instance.
 * Automatically normalizes `publicKey` if it's a string.
 * Throws runtime errors if required fields are missing.
 */
const Identity = async ({
  id,
  publicKey,
  signatures,
  type,
  sign,
  verify,
}: IdentityInput = {}): Promise<IdentityType> => {
  if (!id) throw new Error("Identity id is required");
  if (!publicKey) throw new Error("Invalid public key");

  // Normalize publicKey to object with `raw` property
  const normalizedPublicKey =
    typeof publicKey === "string" ? { raw: publicKey } : publicKey;
  if (!normalizedPublicKey.raw) throw new Error("Invalid public key");

  if (!signatures) throw new Error("Signatures object is required");
  if (!signatures.id) throw new Error("Signature of id is required");
  if (!signatures.publicKey)
    throw new Error("Signature of publicKey+id is required");
  if (!type) throw new Error("Identity type is required");

  const signFn =
    sign ||
    (async (_data: Uint8Array) => {
      throw new Error("sign function not provided");
    });

  const verifyFn =
    verify ||
    (async (_data: Uint8Array, _sig: Uint8Array) => {
      throw new Error("verify function not provided");
    });

  const identity: IdentityType = {
    id,
    publicKey: normalizedPublicKey,
    signatures: signatures as {
      id: unknown;
      publicKey: unknown;
      [key: string]: unknown;
    },
    type,
    sign: signFn,
    verify: verifyFn,
  };

  const { hash, bytes } = await _encodeIdentity({
    id,
    publicKey: normalizedPublicKey,
    signatures: identity.signatures,
    type,
  });

  identity.hash = hash;
  identity.bytes = bytes;

  return identity;
};

/**
 * Encodes a minimal IdentitySerializable object to an IPLD block.
 */
const _encodeIdentity = async (
  identity: IdentitySerializable
): Promise<{ hash: string; bytes: Uint8Array }> => {
  const { id, publicKey, signatures, type } = identity;
  const { cid, bytes } = await Block.encode({
    value: { id, publicKey, signatures, type },
    codec,
    hasher,
  });
  return {
    hash: cid.toString(hashStringEncoding),
    bytes: Uint8Array.from(bytes),
  };
};

/**
 * Decodes identity bytes and returns a new Identity instance.
 */
const decodeIdentity = async (
  bytes: Uint8Array,
  sign?: (data: Uint8Array) => Promise<Uint8Array>,
  verify?: (data: Uint8Array, signature: Uint8Array) => Promise<boolean>
): Promise<IdentityType> => {
  const { value } = await Block.decode({ bytes, codec, hasher });

  if (!value || typeof value !== "object") {
    throw new Error("Decoded identity is not an object");
  }

  const { id, publicKey, signatures, type } = value as IdentitySerializable;

  return Identity({
    id,
    publicKey,
    signatures,
    type,
    sign,
    verify,
  });
};

/**
 * Type guard to check if an object is a valid IdentityType.
 */
const isIdentity = (identity: any): identity is IdentityType => {
  return (
    identity &&
    typeof identity.id === "string" &&
    identity.hash &&
    identity.bytes &&
    identity.publicKey &&
    typeof identity.publicKey.raw === "string" &&
    identity.signatures &&
    identity.signatures.id &&
    identity.signatures.publicKey &&
    identity.type &&
    typeof identity.sign === "function" &&
    typeof identity.verify === "function"
  );
};

/**
 * Compares two identities for equality.
 */
const isEqual = (
  a: IdentityType | null | undefined,
  b: IdentityType | null | undefined
): boolean => {
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.hash === b.hash &&
    a.type === b.type &&
    a.publicKey.raw === b.publicKey.raw &&
    a.signatures.id === b.signatures.id &&
    a.signatures.publicKey === b.signatures.publicKey
  );
};

export { Identity as default, isEqual, isIdentity, decodeIdentity };

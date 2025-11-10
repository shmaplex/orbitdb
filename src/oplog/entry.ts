import * as dagCbor from "@ipld/dag-cbor";
import { base58btc } from "multiformats/bases/base58";
import * as Block from "multiformats/block";
import type { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import Clock, { type ClockType } from "./clock";

const codec = dagCbor;
const hasher = sha256;
const hashStringEncoding = base58btc;

/** Represents a log entry */
export interface EntryType {
  id?: string;
  payload?: unknown;
  next: string[];
  refs: string[];
  clock: ClockType;
  v: number;
  key?: string;
  identity?: string;
  sig?: string;
  bytes?: Uint8Array;
  _payload?: unknown;
  hash?: string;
}

/** Minimal Identity interface for type safety */
export interface Identity {
  hash: string;
  publicKey: string;
  sign(identity: Identity, bytes: Uint8Array): Promise<string>;
}

/** Optional encryption/decryption function types */
export type EncryptFn = (data: Uint8Array) => Promise<Uint8Array>;
export type DecryptFn = (data: Uint8Array) => Promise<Uint8Array>;

/**
 * Creates a new log entry.
 */
export const create = async (
  identity: Identity,
  id: string | null,
  payload: unknown,
  encryptPayloadFn?: EncryptFn,
  clock: ClockType | null = null,
  next: Array<string | EntryType> = [],
  refs: Array<string | EntryType> = []
): Promise<EntryType> => {
  if (!identity) throw new Error("Identity is required");
  if (!id) throw new Error("Entry requires an id");
  if (payload == null) throw new Error("Entry requires a payload");

  const entryClock = clock ?? Clock(identity.publicKey);

  let encryptedPayload: Uint8Array | undefined;
  if (encryptPayloadFn) {
    const { bytes: encodedPayloadBytes } = await Block.encode({
      value: payload,
      codec,
      hasher,
    });
    encryptedPayload = await encryptPayloadFn(encodedPayloadBytes);
  }

  const entry: EntryType = {
    id, // For determining a unique chain
    payload: encryptedPayload ?? payload, // Can be any dag-cbor encodeable data
    next: next.map((n) => {
      if (typeof n === "string") return n;
      if (!n.hash) throw new Error("Next entry missing hash");
      return n.hash;
    }), // Array of strings of CIDs
    refs: refs.map((r) => {
      if (typeof r === "string") return r;
      if (!r.hash) throw new Error("Ref entry missing hash");
      return r.hash;
    }), // Array of strings of CIDs
    clock: entryClock,
    v: 2, // To tag the version of this data structure
    key: "",
    identity: "",
    sig: "",
  };

  const { bytes } = await Block.encode<EntryType, number, number>({
    value: entry,
    codec,
    hasher,
  });

  // Sign the entry bytes
  const signature = await identity.sign(identity, bytes);

  // Populate signature and identity info
  entry.key = identity.publicKey;
  entry.identity = identity.hash;
  entry.sig = signature;

  // If encrypted payload exists, keep it in _payload
  if (encryptPayloadFn) entry._payload = encryptedPayload;

  // Restore the original payload for convenience
  entry.payload = payload;

  return entry;
};

/** Checks if an object is an Entry */
export const isEntry = (obj: unknown): obj is EntryType =>
  typeof obj === "object" &&
  obj !== null &&
  "id" in obj &&
  "next" in obj &&
  "payload" in obj &&
  "v" in obj &&
  "clock" in obj &&
  "refs" in obj;

/** Determines whether two entries are equal by hash */
export const isEqual = (a: EntryType, b: EntryType): boolean =>
  !!(a && b && a.hash && b.hash && a.hash === b.hash);

/** Verifies an entry signature */
export const verify = async (
  identities: {
    verify(sig: string, key: string, bytes: Uint8Array): Promise<boolean>;
  },
  entry: EntryType
): Promise<boolean> => {
  if (!identities) throw new Error("Identities is required");
  if (!isEntry(entry)) throw new Error("Invalid Log entry");
  if (!entry.key || !entry.sig)
    throw new Error("Entry missing key or signature");

  const value = {
    id: entry.id,
    payload: entry._payload ?? entry.payload,
    next: entry.next,
    refs: entry.refs,
    clock: entry.clock,
    value: entry.v,
  };

  const { bytes } = await Block.encode<typeof value, number, number>({
    value,
    codec,
    hasher,
  });
  return identities.verify(entry.sig, entry.key, bytes);
};

/** Decodes a serialized Entry from bytes */
export const decode = async (
  inputBytes: Uint8Array,
  decryptEntryFn?: DecryptFn,
  decryptPayloadFn?: DecryptFn
): Promise<EntryType> => {
  let bytesToDecode = inputBytes;
  let cid: CID | undefined; // Initialize as undefined

  // Optionally decrypt the full entry
  if (decryptEntryFn) {
    try {
      const encryptedBlock = await Block.decode<Uint8Array, number, number>({
        bytes: bytesToDecode,
        codec,
        hasher,
      });
      bytesToDecode = await decryptEntryFn(encryptedBlock.value);
      cid = encryptedBlock.cid;
    } catch {
      throw new Error("Could not decrypt entry");
    }
  }

  // Decode the Entry block
  const decodedBlock = await Block.decode<EntryType, number, number>({
    bytes: bytesToDecode,
    codec,
    hasher,
  });
  const entry: EntryType = decodedBlock.value;

  // Optionally decrypt the payload
  if (decryptPayloadFn && entry.payload instanceof Uint8Array) {
    try {
      const decryptedPayloadBytes = await decryptPayloadFn(entry.payload);
      const { value: decryptedPayload } = await Block.decode<
        unknown,
        number,
        number
      >({
        bytes: decryptedPayloadBytes,
        codec,
        hasher,
      });
      entry._payload = entry.payload;
      entry.payload = decryptedPayload;
    } catch {
      throw new Error("Could not decrypt payload");
    }
  }

  // Use CID from either decryption or decoded block
  cid = cid ?? decodedBlock.cid;
  entry.hash = cid.toString(hashStringEncoding);

  return entry;
};

/** Encodes an Entry and returns its hash and bytes */
export const encode = async (
  entry: EntryType,
  encryptEntryFn?: EncryptFn,
  encryptPayloadFn?: EncryptFn
): Promise<{ hash: string; bytes: Uint8Array }> => {
  const e = { ...entry };

  // Use encrypted payload if provided
  if (encryptPayloadFn && e._payload) {
    e.payload = e._payload;
  }

  // Remove transient properties
  delete e._payload;
  delete e.hash;

  // Encode the entry
  let { cid, bytes } = await Block.encode({
    value: e,
    codec,
    hasher,
  });

  // Optionally encrypt the encoded entry
  if (encryptEntryFn) {
    const encryptedBytes = await encryptEntryFn(bytes);

    // Encode encrypted bytes as a block (type is Uint8Array, not Entry)
    const encryptedBlock = await Block.encode({
      value: encryptedBytes,
      codec,
      hasher,
    });

    cid = encryptedBlock.cid;
    bytes = encryptedBlock.bytes;
  }

  return { hash: cid.toString(hashStringEncoding), bytes };
};

export default { create, verify, decode, encode, isEntry, isEqual };

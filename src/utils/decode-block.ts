// src/utils/decode-block.ts
import * as dagCbor from "@ipld/dag-cbor";
import * as Block from "multiformats/block";
import { sha256 } from "multiformats/hashes/sha2";

/**
 * A ByteView represents the raw bytes of a block.
 * It is basically a Uint8Array.
 */
export type ByteView<T> = Uint8Array;

/**
 * Helper to decode a block from bytes with proper typing.
 * @template T - logical type of the decoded value
 * @param bytes - bytes to decode
 * @param codec - codec used to decode the block
 * @param hasher - hasher used to verify CID (optional)
 * @returns decoded block value
 */
export async function decodeBlock<T>(
  bytes: ByteView<T>,
  codec = dagCbor,
  hasher = sha256
): Promise<T> {
  // Use your Block module to decode
  const decoded = await Block.decode<T, typeof codec.code, typeof hasher.code>({
    bytes,
    codec,
    hasher,
  });

  return decoded.value;
}

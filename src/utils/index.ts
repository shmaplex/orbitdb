/**
 * @module utils
 * @description Utility exports for OrbitDB core functions.
 */

import createId from "./create-id";
import { ByteView, decodeBlock } from "./decode-block";
import { join, posixJoin, win32Join } from "./path-join";

/**
 * Generates a random alphanumeric ID string of the specified length.
 *
 * @param length - Desired length of the generated ID. Default is 32.
 * @returns A promise resolving to a random ID string.
 *
 * @example
 * const id = await createId(16);
 * console.log(id); // → "aZf19xLmO7bKQ3dR"
 */
export { createId };

/**
 * Decodes a block of bytes into a typed value.
 *
 * @template T - Logical type of the decoded value.
 * @param bytes - The raw bytes to decode.
 * @param codec - Codec used for decoding (optional, defaults to dagCbor).
 * @param hasher - Hasher used for verification (optional, defaults to sha256).
 * @returns Decoded value of type T.
 *
 * @example
 * const value = await decodeBlock<MyType>(blockBytes);
 */
export { decodeBlock, ByteView };

/**
 * Cross-platform path joining utilities.
 *
 * @example
 * posixJoin('folder', 'subfolder', './file.txt'); // → "folder/subfolder/file.txt"
 * win32Join('folder', 'subfolder', './file.txt'); // → "folder\\subfolder\\file.txt"
 */
export { posixJoin, win32Join, join };

/**
 * Type definition for the default exported utils object.
 */
export interface Utils {
  createId: typeof createId;
  decodeBlock: typeof decodeBlock;
  posixJoin: typeof posixJoin;
  win32Join: typeof win32Join;
  join: typeof join;
}

/**
 * Default export object containing all utilities.
 */
const utils: Utils = {
  createId,
  decodeBlock,
  posixJoin,
  win32Join,
  join,
};

export default utils;

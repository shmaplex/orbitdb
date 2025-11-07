/**
 * @module Address
 * @description
 * OrbitDB database address verification and parsing utilities.
 */

import { base58btc } from "multiformats/bases/base58";
import { CID } from "multiformats/cid";
import { posixJoin } from "./utils/path-join.js";

export interface OrbitDBAddress {
  protocol: "orbitdb";
  hash: string;
  address: string;
  toString: () => string;
}

/**
 * Checks if a string is a valid OrbitDB database address.
 */
export const isValidAddress = (address: string | OrbitDBAddress): boolean => {
  const addrString = address.toString();

  if (
    !addrString.startsWith("/orbitdb") &&
    !addrString.startsWith("\\orbitdb")
  ) {
    return false;
  }

  const cidString = addrString
    .replaceAll("/orbitdb/", "")
    .replaceAll("\\orbitdb\\", "")
    .replaceAll("/", "")
    .replaceAll("\\", "");

  try {
    const cid = CID.parse(cidString, base58btc);
    return cid !== undefined;
  } catch {
    return false;
  }
};

/**
 * Parses a given OrbitDB address string into an OrbitDBAddress object.
 */
export const parseAddress = (
  address: string | OrbitDBAddress
): OrbitDBAddress => {
  if (!address) {
    throw new Error(`Not a valid OrbitDB address: ${address}`);
  }

  if (!isValidAddress(address)) {
    throw new Error(`Not a valid OrbitDB address: ${address}`);
  }

  return OrbitDBAddressFactory(address);
};

/**
 * Creates a new OrbitDBAddress instance.
 */
export const OrbitDBAddressFactory = (
  address: string | OrbitDBAddress
): OrbitDBAddress => {
  // Return as-is if already a proper object
  if (
    typeof address !== "string" &&
    address.protocol === "orbitdb" &&
    address.hash
  ) {
    return address;
  }

  // Use 'as const' instead of type annotation
  const protocol = "orbitdb" as const;
  const hash =
    typeof address === "string"
      ? address.replace("/orbitdb/", "").replace("\\orbitdb\\", "")
      : address.hash;

  // Internal name avoids shadowing the global Object.toString
  const _toString = (): string => posixJoin("/", protocol, hash);

  return {
    protocol,
    hash,
    address: _toString(),
    toString: _toString,
  };
};

export default OrbitDBAddressFactory;

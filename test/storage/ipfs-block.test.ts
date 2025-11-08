import { describe, it, beforeEach, afterEach, expect } from "vitest";
import * as Block from "multiformats/block";
import * as dagCbor from "@ipld/dag-cbor";
import { sha256 } from "multiformats/hashes/sha2";
import { base58btc } from "multiformats/bases/base58";
import createHelia from "../utils/create-helia.js";
import IPFSBlockStorage from "../../src/storage/ipfs-block.js";

describe("IPFSBlockStorage", () => {
  const codec = dagCbor;
  const hasher = sha256;

  let ipfs: any;
  let storage: any;

  beforeEach(async () => {
    ipfs = await createHelia();
    const pin = true;
    const timeout = 1000;

    storage = await IPFSBlockStorage({ ipfs, pin, timeout });
  });

  afterEach(async () => {
    if (ipfs) {
      await ipfs.stop();
    }
  });

  it("gets a block", async () => {
    const expected = "hello world";
    const { cid, bytes } = await Block.encode({
      value: expected,
      codec,
      hasher,
    });

    const hash = cid.toString(base58btc);

    await storage.put(hash, bytes);

    const data = await storage.get(hash);
    const block = await Block.decode({ bytes: data, codec, hasher });
    const actual = block.value;

    expect(actual).toBe(expected);
  });

  it("checks that a block is pinned", async () => {
    const expected = "hello world";
    const block = await Block.encode({ value: expected, codec, hasher });
    const cid = block.cid.toString(base58btc);

    await storage.put(cid, block.bytes);

    const pinned = await ipfs.pins.isPinned(block.cid);
    expect(pinned).toBe(true);
  });

  it("throws an error if a block does not exist", async () => {
    const value = "i don't exist";
    const block = await Block.encode({ value, codec, hasher });
    const cid = block.cid.toString(base58btc);

    let err: any = null;
    try {
      await storage.get(cid);
    } catch (error: any) {
      err = error;
    }

    expect(err).not.toBeNull();
    expect(err.message).toBe("All promises were rejected");
  });
});

// test/sync/02_params.test.ts
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { setupIdentities, cleanup, copyKeys } from "./helpers";
import Sync from "../../src/sync.js";

let ipfs1: any;
let ipfs2: any;
let keystore: any;

beforeAll(async () => {
  ({ ipfs1, ipfs2, keystore } = await setupIdentities());
  await copyKeys();
});

afterAll(async () => {
  await cleanup([ipfs1, ipfs2], keystore);
});

describe("Sync parameters", () => {
  it("throws an error when IPFS is not defined", async () => {
    await expect(Sync({})).rejects.toThrow("An instance of ipfs is required.");
  });

  it("throws an error when log is not defined", async () => {
    await expect(Sync({ ipfs: ipfs1 })).rejects.toThrow(
      "An instance of log is required."
    );
  });
});

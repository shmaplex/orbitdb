// test/sync/02_params.test.ts
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { setupIdentities, cleanup, copyKeys } from "./helpers";
import Sync from "../../src/sync";

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
    // Force TS to ignore missing properties
    await expect(Sync({} as any)).rejects.toThrow(
      "An instance of ipfs is required."
    );
  });

  it("throws an error when log is not defined", async () => {
    // Force TS to ignore missing 'log' property
    await expect(Sync({ ipfs: ipfs1 } as any)).rejects.toThrow(
      "An instance of log is required."
    );
  });
});

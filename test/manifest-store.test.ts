import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { rimraf } from "rimraf";
import ManifestStore from "../src/manifest-store";
import { createHeliaNode } from "./utils/create-helia";
import { Helia } from "helia";

/**
 * @file ManifestStore Test Suite
 * @description Tests for creating and retrieving manifests using ManifestStore and Helia.
 */

describe("Manifest", () => {
  const repo = "./ipfs";
  let ipfs: Helia;
  let manifestStore: Awaited<ReturnType<typeof ManifestStore>>;

  /**
   * Initialize Helia IPFS node and ManifestStore before all tests.
   */
  beforeAll(async () => {
    ipfs = await createHeliaNode({ directory: repo });
    manifestStore = await ManifestStore({ ipfs });
  });

  /**
   * Clean up resources after all tests.
   */
  afterAll(async () => {
    if (manifestStore?.close) await manifestStore.close();
    if (ipfs?.stop) await ipfs.stop();
    await rimraf(repo);
  });

  it("creates a manifest", async () => {
    const name = "database";
    const type = "keyvalue";
    const accessController = "test/default-access-controller";
    const expectedManifest = { name, type, accessController };

    const { hash, manifest } = await manifestStore.create({
      name,
      type,
      accessController,
    });

    // We can’t hardcode hash if IPFS generates it dynamically
    expect(hash).toBeDefined();
    expect(manifest).toEqual(expectedManifest);
  });

  it("loads a manifest", async () => {
    const created = await manifestStore.create({
      name: "database",
      type: "keyvalue",
      accessController: "test/default-access-controller",
    });

    const manifest = await manifestStore.get(created.hash);

    expect(manifest).toEqual({
      name: "database",
      type: "keyvalue",
      accessController: "test/default-access-controller",
    });
  });

  it("creates a manifest with metadata", async () => {
    const meta = {
      name: "database",
      description: "more information about the database",
    };

    const { hash, manifest } = await manifestStore.create({
      name: "database",
      type: "keyvalue",
      accessController: "test/default-access-controller",
      meta,
    });

    expect(hash).toBeDefined();
    expect(manifest.meta).toEqual(meta);
  });

  it("throws an error if name is not specified", async () => {
    await expect(manifestStore.create({} as any)).rejects.toThrow(
      "name is required"
    );
  });

  it("throws an error if type is not specified", async () => {
    await expect(
      manifestStore.create({ name: "database" } as any)
    ).rejects.toThrow("type is required");
  });

  it("throws an error if accessController is not specified", async () => {
    await expect(
      manifestStore.create({ name: "database", type: "keyvalue" } as any)
    ).rejects.toThrow("accessController is required");
  });
});

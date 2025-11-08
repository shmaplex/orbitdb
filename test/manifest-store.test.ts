import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { rimraf } from "rimraf";
import ManifestStore from "../src/manifest-store.js";
import createHelia from "./utils/create-helia.js";

/**
 * @file ManifestStore Test Suite
 * @description Tests for creating and retrieving manifests using ManifestStore and Helia.
 */

describe("Manifest", () => {
  const repo = "./ipfs";
  let ipfs: any;
  let manifestStore: any;

  /**
   * Initialize Helia IPFS node and ManifestStore before all tests.
   */
  beforeAll(async () => {
    ipfs = await createHelia();
    manifestStore = await ManifestStore({ ipfs });
  });

  /**
   * Clean up resources after all tests.
   */
  afterAll(async () => {
    await manifestStore.close();
    await ipfs.stop();
    await rimraf(repo);
  });

  it("creates a manifest", async () => {
    const name = "database";
    const type = "keyvalue";
    const accessController = "test/default-access-controller";
    const expectedHash = "zdpuAn26ookFToGNmpVHgEM71YMULiyS8mAs9UQtV1g6eEyRP";
    const expectedManifest = { name, type, accessController };

    const { hash, manifest } = await manifestStore.create({
      name,
      type,
      accessController,
    });

    expect(hash).toBe(expectedHash);
    expect(manifest).toEqual(expectedManifest);
  });

  it("loads a manifest", async () => {
    const expectedHash = "zdpuAn26ookFToGNmpVHgEM71YMULiyS8mAs9UQtV1g6eEyRP";
    const expectedManifest = {
      name: "database",
      type: "keyvalue",
      accessController: "test/default-access-controller",
    };

    const manifest = await manifestStore.get(expectedHash);

    expect(manifest).toEqual(expectedManifest);
  });

  it("creates a manifest with metadata", async () => {
    const name = "database";
    const type = "keyvalue";
    const accessController = "test/default-access-controller";
    const expectedHash = "zdpuAyWPs4yAXS6W7CY4UM68pV2NCpzAJr98aMA4zS5XRq5ga";
    const meta = { name, description: "more information about the database" };

    const { hash, manifest } = await manifestStore.create({
      name,
      type,
      accessController,
      meta,
    });

    expect(hash).toBe(expectedHash);
    expect(manifest.meta).toEqual(meta);
  });

  it("throws an error if name is not specified", async () => {
    await expect(manifestStore.create({})).rejects.toThrow("name is required");
  });

  it("throws an error if type is not specified", async () => {
    await expect(manifestStore.create({ name: "database" })).rejects.toThrow(
      "type is required"
    );
  });

  it("throws an error if accessController is not specified", async () => {
    await expect(
      manifestStore.create({ name: "database", type: "keyvalue" })
    ).rejects.toThrow("accessController is required");
  });
});

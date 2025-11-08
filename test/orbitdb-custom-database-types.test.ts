import { describe, it, beforeAll, expect, afterAll, beforeEach } from "vitest";
import { rimraf } from "rimraf";
import { existsSync } from "fs";
import { getDatabaseType } from "../src/databases/index.js";
import {
  createOrbitDB,
  useDatabaseType,
  Database,
  KeyValueIndexed,
} from "../src/index.js";
import pathJoin from "../src/utils/path-join.js";
import createHelia from "./utils/create-helia.js";

/**
 * @file Custom Database Type Test Suite
 * @description Tests for adding and using custom database types in OrbitDB
 */

const type = "custom!";

/**
 * A simple custom database type
 */
const CustomStore =
  () =>
  async ({
    ipfs,
    identity,
    address,
    name,
    access,
    directory,
    meta,
    headsStorage,
    entryStorage,
    indexStorage,
    referencesCount,
    syncAutomatically,
    onUpdate,
  }: any) => {
    const database = await Database({
      ipfs,
      identity,
      address,
      name,
      access,
      directory,
      meta,
      headsStorage,
      entryStorage,
      indexStorage,
      referencesCount,
      syncAutomatically,
      onUpdate,
    });

    return {
      ...database,
      type,
    };
  };

CustomStore.type = type;

describe("Add a custom database type", () => {
  let ipfs: any;
  let orbitdb: any;

  beforeAll(async () => {
    ipfs = await createHelia();
    orbitdb = await createOrbitDB({ ipfs });
  });

  afterAll(async () => {
    if (orbitdb) await orbitdb.stop();
    if (ipfs) await ipfs.stop();
    await rimraf("./orbitdb");
    await rimraf("./ipfs1");
  });

  describe("Default supported database types", () => {
    it("throws an error if custom database type hasn't been added", async () => {
      let err: any;
      try {
        await orbitdb.open("hello", { type });
      } catch (e: any) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.message).toBe("Unsupported database type: 'custom!'");
    });
  });

  describe("KeyValue Indexed database type", () => {
    it("replaces keyvalue with keyvalue-indexed", async () => {
      useDatabaseType(KeyValueIndexed);
      const name = "hello keyvalue-indexed database";
      const db = await orbitdb.open(name, { type: "keyvalue" });

      const indexDirectory = pathJoin("./orbitdb", `./${db.address}/_index/`);

      expect(existsSync(indexDirectory)).toBe(true);
    });
  });

  describe("Custom database type", () => {
    beforeEach(() => {
      useDatabaseType(CustomStore);
    });

    it("creates a database with the custom database type", async () => {
      const name = "hello custom database";
      const db = await orbitdb.open(name, { type });
      expect(db.type).toBe(type);
      expect(db.name).toBe(name);
    });

    it("returns custom database type after adding it", async () => {
      expect(getDatabaseType(type)).toEqual(CustomStore);
    });
  });
});

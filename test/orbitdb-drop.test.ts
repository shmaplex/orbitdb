import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { rimraf } from "rimraf";
import { createOrbitDB } from "../src";
import createHelia from "./utils/create-helia";

/**
 * @file Drop Databases Test Suite
 * @description Tests for dropping databases in OrbitDB
 */

describe("Drop databases", () => {
  let ipfs: any;
  let orbitdb1: any;
  let db: any;
  const amount = 10;

  beforeAll(async () => {
    ipfs = await createHelia();
  });

  afterAll(async () => {
    if (ipfs) await ipfs.stop();
    await rimraf("./orbitdb");
    await rimraf("./ipfs");
  });

  describe("dropping a database", () => {
    beforeAll(async () => {
      orbitdb1 = await createOrbitDB({ ipfs, id: "user1" });
      db = await orbitdb1.open("helloworld");
    });

    afterAll(async () => {
      if (db) await db.close();
      if (orbitdb1) await orbitdb1.stop();
      await rimraf("./orbitdb");
    });

    it("returns no entries in the database after dropping it", async () => {
      for (let i = 0; i < amount; i++) {
        await db.add("hello" + i);
      }

      const before = await db.all();
      expect(before.length).toBe(amount);

      await db.drop();

      const after = await db.all();
      expect(after.length).toBe(0);
    });

    it("returns no heads for the database oplog after dropping it", async () => {
      for (let i = 0; i < amount; i++) {
        await db.add("hello" + i);
      }

      const before = await db.log.heads();
      expect(before.length).toBe(1);

      await db.drop();

      const after = await db.log.heads();
      expect(after.length).toBe(0);
    });

    it("returns no entries when a dropped database is opened again after closing", async () => {
      for (let i = 0; i < amount; i++) {
        await db.add("hello" + i);
      }

      const before = await db.all();
      expect(before.length).toBe(amount);

      await db.drop();
      await db.close();

      db = await orbitdb1.open("helloworld");

      const after = await db.all();
      expect(after.length).toBe(0);
    });
  });

  describe("dropping an empty database", () => {
    beforeAll(async () => {
      orbitdb1 = await createOrbitDB({ ipfs, id: "user1" });
      db = await orbitdb1.open("helloworld");
    });

    afterAll(async () => {
      if (db) {
        await db.drop();
        await db.close();
      }
      if (orbitdb1) await orbitdb1.stop();
      await rimraf("./orbitdb1");
    });

    it("doesn't error when dropping an empty database", async () => {
      let err: any;
      try {
        await db.drop();
      } catch (e) {
        err = e;
      }
      expect(err).toBeUndefined();
    });
  });
});

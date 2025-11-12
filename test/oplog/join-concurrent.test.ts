import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { rimraf } from "rimraf";
import { copy } from "fs-extra";
import { Log, Identities, KeyStore } from "../../src";
import testKeysPath from "../fixtures/test-keys-path";

const keysPath = "./testkeys";

describe("Log - Join Concurrent Entries", () => {
  let keystore: any;
  let identities1: any;
  let testIdentity: any, testIdentity2: any;

  beforeAll(async () => {
    await copy(testKeysPath, keysPath);
    keystore = await KeyStore({ path: keysPath });
    identities1 = await Identities({ keystore });
    testIdentity = await identities1.createIdentity({ id: "userA" });
    testIdentity2 = await identities1.createIdentity({ id: "userB" });
  });

  afterAll(async () => {
    if (keystore) {
      await keystore.close();
    }
    await rimraf(keysPath);
  });

  describe("join", () => {
    let log1: any, log2: any;

    beforeAll(async () => {
      log1 = await Log(testIdentity, { logId: "A" });
      log2 = await Log(testIdentity2, { logId: "A" });
    });

    it("joins consistently", async () => {
      for (let i = 0; i < 10; i++) {
        await log1.append("hello1-" + i);
        await log2.append("hello2-" + i);
      }

      await log1.join(log2);
      await log2.join(log1);

      const values1 = await log1.values();
      const values2 = await log2.values();

      expect(values1.length).toBe(20);
      expect(values2.length).toBe(20);
      expect(values1.map((e: any) => e.payload && e.hash)).toEqual(
        values2.map((e: any) => e.payload && e.hash)
      );
    });

    it("concurrently appending same payload after join results in same state", async () => {
      for (let i = 10; i < 20; i++) {
        await log1.append("hello1-" + i);
        await log2.append("hello2-" + i);
      }

      await log1.join(log2);
      await log2.join(log1);

      await log1.append("same");
      await log2.append("same");

      const values1 = await log1.values();
      const values2 = await log2.values();

      expect(values1.length).toBe(41);
      expect(values2.length).toBe(41);
      expect(values1.map((e: any) => e.payload && e.hash)).toEqual(
        values2.map((e: any) => e.payload && e.hash)
      );
    });

    it("joining after concurrently appending same payload joins entry once", async () => {
      await log1.join(log2);
      await log2.join(log1);

      const values1 = await log1.values();
      const values2 = await log2.values();

      expect(values1.length).toBe(42);
      expect(values2.length).toBe(42);
      expect(values1.map((e: any) => e.payload && e.hash)).toEqual(
        values2.map((e: any) => e.payload && e.hash)
      );
    });
  });
});

import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { rimraf } from "rimraf";
import { copy } from "fs-extra";
import { Log } from "../../src/oplog/index.js";
import { Identities, KeyStore, KeyStoreType } from "../../src/index.js";
import testKeysPath from "../fixtures/test-keys-path.js";
import { keysPath, last } from "./utils/test-setup"; // import the helper

describe("Log - References", () => {
  let keystore: KeyStoreType;
  let identities: any;
  let testIdentity: any;

  beforeAll(async () => {
    await copy(testKeysPath, keysPath);
    keystore = await KeyStore({ path: keysPath });
    identities = await Identities({ keystore });
    testIdentity = await identities.createIdentity({ id: "userA" });
  });

  afterAll(async () => {
    if (keystore) await keystore.close();
    await rimraf(keysPath);
  });

  describe("References", () => {
    const testReferenceCount = async (
      logId: string,
      amount: number,
      referencesCount: number
    ) => {
      const log = await Log(testIdentity, { logId });
      for (let i = 0; i < amount; i++) {
        await log.append(i.toString(), { referencesCount });
      }

      const values = await log.values();
      expect(values.length).toBeGreaterThan(0);

      // TypeScript-safe: assert that lastValue exists
      const lastValue = last(values);
      expect(lastValue).toBeDefined();
      expect(lastValue.refs!.length).toBe(referencesCount);
    };

    it("creates entries with 1 reference", async () => {
      await testReferenceCount("A", 32, 1);
    });

    it("creates entries with 2 references", async () => {
      await testReferenceCount("A", 32, 2);
    });

    it("creates entries with 4 references", async () => {
      await testReferenceCount("B", 32, 4);
    });

    it("creates entries with 8 references", async () => {
      await testReferenceCount("C", 64, 8);
    });

    it("creates entries with 16 references", async () => {
      await testReferenceCount("D", 64, 16);
    });

    it("creates entries with 32 references", async () => {
      await testReferenceCount("D", 64, 32);
    });

    it("creates entries with 64 references", async () => {
      await testReferenceCount("D", 128, 64);
    });

    it("creates entries with 128 references", async () => {
      // +2 because first ref is always skipped (covered by next field)
      await testReferenceCount("D", 128 + 2, 128);
    });
  });
});

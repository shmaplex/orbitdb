import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { rimraf } from "rimraf";
import { copy } from "fs-extra";
import { Log } from "../../src/oplog/index.js";
import { Identities, KeyStore } from "../../src/index.js";
import testKeysPath from "../fixtures/test-keys-path.js";

const keysPath = "./testkeys";

describe("Log - References", () => {
  let keystore: KeyStore;
  let identities: any;
  let testIdentity: any;

  beforeAll(async () => {
    await copy(testKeysPath, keysPath);
    keystore = await KeyStore({ path: keysPath });
    identities = await Identities({ keystore });
    testIdentity = await identities.createIdentity({ id: "userA" });
  });

  afterAll(async () => {
    if (keystore) {
      await keystore.close();
    }
    await rimraf(keysPath);
  });

  describe("References", () => {
    it("creates entries with 1 references", async () => {
      const amount = 32;
      const referencesCount = 1;
      const log = await Log(testIdentity, { logId: "A" });

      for (let i = 0; i < amount; i++) {
        await log.append(i.toString(), { referencesCount });
      }

      const values = await log.values();
      expect(values[values.length - 1].refs.length).toBe(referencesCount);
    });

    it("creates entries with 2 references", async () => {
      const amount = 32;
      const referencesCount = 2;
      const log = await Log(testIdentity, { logId: "A" });

      for (let i = 0; i < amount; i++) {
        await log.append(i.toString(), { referencesCount });
      }

      const values = await log.values();
      expect(values[values.length - 1].refs.length).toBe(referencesCount);
    });

    it("creates entries with 4 references", async () => {
      const amount = 32;
      const referencesCount = 4;
      const log = await Log(testIdentity, { logId: "B" });

      for (let i = 0; i < amount; i++) {
        await log.append(i.toString(), { referencesCount });
      }

      const values = await log.values();
      expect(values[values.length - 1].refs.length).toBe(referencesCount);
    });

    it("creates entries with 8 references", async () => {
      const amount = 64;
      const referencesCount = 8;
      const log = await Log(testIdentity, { logId: "C" });

      for (let i = 0; i < amount; i++) {
        await log.append(i.toString(), { referencesCount });
      }

      const values = await log.values();
      expect(values[values.length - 1].refs.length).toBe(referencesCount);
    });

    it("creates entries with 16 references", async () => {
      const amount = 64;
      const referencesCount = 16;
      const log = await Log(testIdentity, { logId: "D" });

      for (let i = 0; i < amount; i++) {
        await log.append(i.toString(), { referencesCount });
      }

      const values = await log.values();
      expect(values[values.length - 1].refs.length).toBe(referencesCount);
    });

    it("creates entries with 32 references", async () => {
      const amount = 64;
      const referencesCount = 32;
      const log = await Log(testIdentity, { logId: "D" });

      for (let i = 0; i < amount; i++) {
        await log.append(i.toString(), { referencesCount });
      }

      const values = await log.values();
      expect(values[values.length - 1].refs.length).toBe(referencesCount);
    });

    it("creates entries with 64 references", async () => {
      const amount = 128;
      const referencesCount = 64;
      const log = await Log(testIdentity, { logId: "D" });

      for (let i = 0; i < amount; i++) {
        await log.append(i.toString(), { referencesCount });
      }

      const values = await log.values();
      expect(values[values.length - 1].refs.length).toBe(referencesCount);
    });

    it("creates entries with 128 references", async () => {
      // +2 because first ref is always skipped (covered by next field) and
      // we need 129 entries to have 128 back references
      const amount = 128 + 2;
      const referencesCount = 128;
      const log = await Log(testIdentity, { logId: "D" });

      for (let i = 0; i < amount; i++) {
        await log.append(i.toString(), { referencesCount });
      }

      const values = await log.values();
      expect(values[values.length - 1].refs.length).toBe(referencesCount);
    });
  });
});

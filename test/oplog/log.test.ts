import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { rimraf } from "rimraf";
import { copy } from "fs-extra";
import {
  Log,
  Entry,
  Identities,
  KeyStore,
  MemoryStorage,
} from "../../src/index.js";
import testKeysPath from "../fixtures/test-keys-path.js";

const { create } = Entry;
const keysPath = "./testkeys";

describe("Log", () => {
  let keystore: KeyStore;
  let identities: Identities;
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

  describe("create", () => {
    it("creates an empty log with default params", async () => {
      const log = await Log(testIdentity);
      expect(log.heads).not.toBeUndefined();
      expect(log.id).not.toBeUndefined();
      expect(await log.clock()).not.toBeUndefined();
      expect(await log.heads()).not.toBeUndefined();
      expect(await log.heads()).toEqual([]);

      const values = await log.values();
      expect(values).toEqual([]);
    });

    it("sets an id", async () => {
      const log = await Log(testIdentity, { logId: "ABC" });
      expect(log.id).toBe("ABC");
    });

    it("sets the clock id", async () => {
      const log = await Log(testIdentity, { logId: "ABC" });
      expect(log.id).toBe("ABC");
      expect((await log.clock()).id).toBe(testIdentity.publicKey);
    });

    it("generates id string if id is not passed", async () => {
      const log = await Log(testIdentity);
      expect(typeof log.id).toBe("string");
    });

    it("sets one head if multiple are given as params", async () => {
      const one = await create(testIdentity, "A", "entryA", null, null, []);
      const { hash: hash1, bytes: bytes1 } = await Entry.encode(one);
      const two = await create(testIdentity, "A", "entryB", null, null, [
        hash1,
      ]);
      const { hash: hash2, bytes: bytes2 } = await Entry.encode(two);
      const three = await create(testIdentity, "A", "entryC", null, null, [
        hash2,
      ]);
      const { hash: hash3, bytes: bytes3 } = await Entry.encode(three);
      const four = await create(testIdentity, "A", "entryD", null, null, [
        hash3,
      ]);
      const { hash: hash4, bytes: bytes4 } = await Entry.encode(four);

      const entryStorage = await MemoryStorage();
      await entryStorage.put(hash1, bytes1);
      await entryStorage.put(hash2, bytes2);
      await entryStorage.put(hash3, bytes3);
      await entryStorage.put(hash4, bytes4);

      three.hash = hash3;
      two.hash = hash2;

      const log = await Log(testIdentity, {
        logId: "A",
        logHeads: [three, three, two, two],
        entryStorage,
      });

      const values = await log.values();
      const heads = await log.heads();
      expect(heads.length).toBe(1);
      expect(heads[0].hash).toBe(three.hash);
      expect(values.length).toBe(3);
    });

    it("sets two heads if two given as params", async () => {
      const one = await create(testIdentity, "A", "entryA", null, null, []);
      const { hash: hash1, bytes: bytes1 } = await Entry.encode(one);
      const two = await create(testIdentity, "A", "entryB", null, null, [
        hash1,
      ]);
      const { hash: hash2, bytes: bytes2 } = await Entry.encode(two);
      const three = await create(testIdentity, "A", "entryC", null, null, [
        hash2,
      ]);
      const { hash: hash3, bytes: bytes3 } = await Entry.encode(three);
      const four = await create(testIdentity, "A", "entryD", null, null, [
        hash2,
      ]);
      const { hash: hash4, bytes: bytes4 } = await Entry.encode(four);

      const entryStorage = await MemoryStorage();
      await entryStorage.put(hash1, bytes1);
      await entryStorage.put(hash2, bytes2);
      await entryStorage.put(hash3, bytes3);
      await entryStorage.put(hash4, bytes4);

      three.hash = hash3;
      four.hash = hash4;
      two.hash = hash2;

      const log = await Log(testIdentity, {
        logId: "A",
        logHeads: [three, four, two],
        entryStorage,
      });

      const values = await log.values();
      const heads = await log.heads();
      expect(heads.length).toBe(2);
      expect(heads[1].hash).toBe(three.hash);
      expect(heads[0].hash).toBe(four.hash);
      expect(values.length).toBe(4);
    });

    it("throws an error if heads is not an array", async () => {
      let err;
      try {
        await Log(testIdentity, {
          logId: "A",
          entries: [],
          logHeads: {} as any,
        });
      } catch (e: any) {
        err = e;
      }
      expect(err).not.toBeUndefined();
      expect(err.message).toBe("'logHeads' argument must be an array");
    });

    it("creates default public AccessController if not defined", async () => {
      const log = await Log(testIdentity);
      const anyoneCanAppend = await log.access.canAppend("any");
      expect(log.access).not.toBeUndefined();
      expect(anyoneCanAppend).toBe(true);
    });

    it("throws an error if identity is not defined", async () => {
      let err;
      try {
        await Log();
      } catch (e: any) {
        err = e;
      }
      expect(err).not.toBeUndefined();
      expect(err.message).toBe("Identity is required");
    });
  });

  describe("values", () => {
    it("returns all entries in the log", async () => {
      const log = await Log(testIdentity);
      let values = await log.values();
      expect(Array.isArray(values)).toBe(true);
      expect(values.length).toBe(0);

      await log.append("hello1");
      await log.append("hello2");
      await log.append("hello3");

      values = await log.values();
      expect(Array.isArray(values)).toBe(true);
      expect(values.length).toBe(3);
      expect(values[0].payload).toBe("hello1");
      expect(values[1].payload).toBe("hello2");
      expect(values[2].payload).toBe("hello3");
    });
  });
});

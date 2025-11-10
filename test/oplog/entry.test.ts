import { strictEqual, deepStrictEqual } from "assert";
import { rimraf } from "rimraf";
import { copy } from "fs-extra";
import { describe, it, beforeAll, afterAll } from "vitest";
import { Entry, Identities, KeyStore } from "../../src";
import testKeysPath from "../fixtures/test-keys-path";
import { tickClock } from "../../src/oplog/clock";

const { create, isEntry } = Entry;
const keysPath = "./testkeys";

describe("Entry", () => {
  let keystore: any;
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

  describe("create", () => {
    it("creates an empty entry", async () => {
      const expectedHash = "zdpuAsKzwUEa8cz9pkJxxFMxLuP3cutA9PDGoLZytrg4RSVEa";
      const entry = await create(testIdentity, "A", "hello");
      const { hash } = await Entry.encode(entry);
      strictEqual(hash, expectedHash);
      strictEqual(entry.id, "A");
      strictEqual(entry.clock.id, testIdentity.publicKey);
      strictEqual(entry.clock.time, 0);
      strictEqual(entry.v, 2);
      strictEqual(entry.payload, "hello");
      strictEqual(entry.next.length, 0);
      strictEqual(entry.refs.length, 0);
    });

    it("creates an entry with payload", async () => {
      const expectedHash = "zdpuAmthfqpHRQjdSpKN5etr1GrreJb7QcU1Hshm6pERnzsxi";
      const payload = "hello world";
      const entry = await create(testIdentity, "A", payload);
      const { hash } = await Entry.encode(entry);
      strictEqual(hash, expectedHash);
      strictEqual(entry.payload, payload);
      strictEqual(entry.id, "A");
      strictEqual(entry.clock.id, testIdentity.publicKey);
      strictEqual(entry.clock.time, 0);
      strictEqual(entry.v, 2);
      strictEqual(entry.next.length, 0);
      strictEqual(entry.refs.length, 0);
    });

    it("retrieves the identity from an entry", async () => {
      const expected = {
        id: testIdentity.id,
        publicKey: testIdentity.publicKey,
        signatures: testIdentity.signatures,
        type: testIdentity.type,
        hash: testIdentity.hash,
        bytes: testIdentity.bytes,
        sign: undefined,
        verify: undefined,
      };
      const entry = await create(testIdentity, "A", "hello world");
      const entryIdentity = await identities.getIdentity(entry.identity);
      deepStrictEqual(entryIdentity, expected);
    });

    it("creates an entry with payload and next", async () => {
      const payload1 = "hello world";
      const payload2 = "hello again";
      const entry1 = await create(testIdentity, "A", payload1);
      entry1.clock = tickClock(entry1.clock);
      const entry2 = await create(
        testIdentity,
        "A",
        payload2,
        null,
        entry1.clock,
        [entry1]
      );
      strictEqual(entry2.payload, payload2);
      strictEqual(entry2.next.length, 1);
      strictEqual(entry2.clock.id, testIdentity.publicKey);
      strictEqual(entry2.clock.time, 1);
    });

    it("`next` parameter can be an array of strings", async () => {
      const entry1 = await create(testIdentity, "A", "hello1");
      const { hash } = await Entry.encode(entry1);
      const entry2 = await create(testIdentity, "A", "hello2", null, null, [
        hash,
      ]);
      strictEqual(typeof entry2.next[0] === "string", true);
    });

    it("throws an error if no params are defined", async () => {
      let err: any;
      try {
        await create();
      } catch (e) {
        err = e;
      }
      strictEqual(err.message, "Identity is required, cannot create entry");
    });

    it("throws an error if identity is not defined", async () => {
      let err: any;
      try {
        await create(null, "A", "hello2");
      } catch (e) {
        err = e;
      }
      strictEqual(err.message, "Identity is required, cannot create entry");
    });

    it("throws an error if id is not defined", async () => {
      let err: any;
      try {
        await create(testIdentity, null, "hello");
      } catch (e) {
        err = e;
      }
      strictEqual(err.message, "Entry requires an id");
    });

    it("throws an error if payload is not defined", async () => {
      let err: any;
      try {
        await create(testIdentity, "A", null);
      } catch (e) {
        err = e;
      }
      strictEqual(err.message, "Entry requires a payload");
    });

    it("throws an error if next is not an array", async () => {
      let err: any;
      try {
        await create(testIdentity, "A", "hello", null, null, {});
      } catch (e) {
        err = e;
      }
      strictEqual(err.message, "'next' argument is not an array");
    });
  });

  describe("isEntry", () => {
    it("is an Entry", async () => {
      const entry = await create(testIdentity, "A", "hello");
      strictEqual(isEntry(entry), true);
    });

    it("is not an Entry - no id", async () => {
      const fakeEntry = { next: [], v: 1, hash: "Foo", payload: 123, seq: 0 };
      strictEqual(isEntry(fakeEntry), false);
    });

    it("is not an Entry - no seq", async () => {
      const fakeEntry = { next: [], v: 1, hash: "Foo", payload: 123 };
      strictEqual(isEntry(fakeEntry), false);
    });

    it("is not an Entry - no next", async () => {
      const fakeEntry = { id: "A", v: 1, hash: "Foo", payload: 123, seq: 0 };
      strictEqual(isEntry(fakeEntry), false);
    });

    it("is not an Entry - no version", async () => {
      const fakeEntry = { id: "A", next: [], payload: 123, seq: 0 };
      strictEqual(isEntry(fakeEntry), false);
    });

    it("is not an Entry - no hash", async () => {
      const fakeEntry = { id: "A", v: 1, next: [], payload: 123, seq: 0 };
      strictEqual(isEntry(fakeEntry), false);
    });

    it("is not an Entry - no payload", async () => {
      const fakeEntry = { id: "A", v: 1, next: [], hash: "Foo", seq: 0 };
      strictEqual(isEntry(fakeEntry), false);
    });
  });
});

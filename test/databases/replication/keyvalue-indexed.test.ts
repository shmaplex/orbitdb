import { describe, it, beforeAll, afterAll, afterEach } from "vitest";
import { deepStrictEqual } from "assert";
import { rimraf } from "rimraf";
import { copy } from "fs-extra";
import { KeyStore, Identities } from "../../../src/index.js";
import KeyValueIndexed from "../../../src/databases/keyvalue-indexed.js";
import testKeysPath from "../../fixtures/test-keys-path.js";
import connectPeers from "../../utils/connect-nodes.js";
import waitFor from "../../utils/wait-for.js";
import createHelia from "../../utils/create-helia.js";
import { EntryType } from "../../../src/oplog/index.js";

const keysPath = "./testkeys";

describe("KeyValueIndexed Database Replication", () => {
  let ipfs1: any, ipfs2: any;
  let keystore: any;
  let identities: any;
  let testIdentity1: any, testIdentity2: any;
  let kv1: any, kv2: any;

  const databaseId = "kv-AAA";

  const accessController = {
    canAppend: async (entry: any) => {
      const identity = await identities.getIdentity(entry.identity);
      return (
        identity.id === testIdentity1.id || identity.id === testIdentity2.id
      );
    },
  };

  beforeAll(async () => {
    [ipfs1, ipfs2] = await Promise.all([createHelia(), createHelia()]);
    await connectPeers(ipfs1, ipfs2);

    await rimraf(keysPath);
    await rimraf("./orbitdb1");
    await rimraf("./orbitdb2");
    await rimraf("./ipfs1");
    await rimraf("./ipfs2");

    await copy(testKeysPath, keysPath);
    keystore = await KeyStore({ path: keysPath });
    identities = await Identities({ keystore });
    testIdentity1 = await identities.createIdentity({ id: "userA" });
    testIdentity2 = await identities.createIdentity({ id: "userB" });
  }, 30000);

  afterAll(async () => {
    if (ipfs1) await ipfs1.stop();
    if (ipfs2) await ipfs2.stop();
    if (keystore) await keystore.close();

    await rimraf(keysPath);
    await rimraf("./orbitdb1");
    await rimraf("./orbitdb2");
    await rimraf("./ipfs1");
    await rimraf("./ipfs2");
  });

  afterEach(async () => {
    if (kv1) {
      await kv1.drop();
      await kv1.close();
      kv1 = null;
    }
    if (kv2) {
      await kv2.drop();
      await kv2.close();
      kv2 = null;
    }
  });

  it("replicates a database", async () => {
    let replicated = false;
    let expectedEntryHash: string | null = null;

    const onConnected = (_peerId: any, heads: any[]) => {
      replicated =
        expectedEntryHash !== null &&
        heads.map((e) => e.hash).includes(expectedEntryHash);
    };

    const onUpdate = (entry: any) => {
      replicated =
        expectedEntryHash !== null && entry.hash === expectedEntryHash;
    };

    const onError = (err: any) => {
      console.error(err);
    };

    kv1 = await KeyValueIndexed()({
      ipfs: ipfs1,
      identity: testIdentity1,
      address: databaseId,
      accessController,
      directory: "./orbitdb1",
    });
    kv2 = await KeyValueIndexed()({
      ipfs: ipfs2,
      identity: testIdentity2,
      address: databaseId,
      accessController,
      directory: "./orbitdb2",
    });

    kv2.events.on("join", onConnected);
    kv2.events.on("update", onUpdate);
    kv2.events.on("error", onError);
    kv1.events.on("error", onError);

    await kv1.set("init", true);
    await kv1.set("hello", "friend");
    await kv1.del("hello");
    await kv1.set("hello", "friend2");
    await kv1.del("hello");
    await kv1.set("empty", "");
    await kv1.del("empty");
    expectedEntryHash = await kv1.set("hello", "friend3");

    await waitFor(
      () => replicated,
      () => true
    );

    deepStrictEqual(await kv2.get("init"), true);
    deepStrictEqual(await kv2.get("hello"), "friend3");
    deepStrictEqual(await kv1.get("hello"), "friend3");
    deepStrictEqual(await kv1.get("empty"), undefined);

    const all2: any[] = [];
    for await (const keyValue of kv2.iterator()) all2.push(keyValue);
    deepStrictEqual(
      all2.map((e) => ({ key: e.key, value: e.value })),
      [
        { key: "init", value: true },
        { key: "hello", value: "friend3" },
      ]
    );

    const all1: any[] = [];
    for await (const keyValue of kv1.iterator()) all1.push(keyValue);
    deepStrictEqual(
      all1.map((e) => ({ key: e.key, value: e.value })),
      [
        { key: "init", value: true },
        { key: "hello", value: "friend3" },
      ]
    );
  });

  it("loads the database after replication", async () => {
    let replicated = false;
    let expectedEntryHash: string | null = null;

    const onConnected = (_peerId: any, heads: any[]) => {
      replicated =
        expectedEntryHash !== null &&
        heads.map((e) => e.hash).includes(expectedEntryHash);
    };

    const onUpdate = (entry: any) => {
      replicated =
        expectedEntryHash !== null && entry.hash === expectedEntryHash;
    };

    const onError = (err: any) => {
      console.error(err);
    };

    kv1 = await KeyValueIndexed()({
      ipfs: ipfs1,
      identity: testIdentity1,
      address: databaseId,
      accessController,
      directory: "./orbitdb1",
    });
    kv2 = await KeyValueIndexed()({
      ipfs: ipfs2,
      identity: testIdentity2,
      address: databaseId,
      accessController,
      directory: "./orbitdb2",
    });

    kv2.events.on("join", onConnected);
    kv2.events.on("update", onUpdate);
    kv2.events.on("error", onError);
    kv1.events.on("error", onError);

    await kv1.set("init", true);
    await kv1.set("hello", "friend");
    await kv1.del("hello");
    await kv1.set("hello", "friend2");
    await kv1.del("hello");
    await kv1.set("empty", "");
    await kv1.del("empty");
    expectedEntryHash = await kv1.set("hello", "friend3");

    await waitFor(
      () => replicated,
      () => true
    );

    await kv1.close();
    await kv2.close();

    kv1 = await KeyValueIndexed()({
      ipfs: ipfs1,
      identity: testIdentity1,
      address: databaseId,
      accessController,
      directory: "./orbitdb1",
    });
    kv2 = await KeyValueIndexed()({
      ipfs: ipfs2,
      identity: testIdentity2,
      address: databaseId,
      accessController,
      directory: "./orbitdb2",
    });

    deepStrictEqual(await kv2.get("init"), true);
    deepStrictEqual(await kv2.get("hello"), "friend3");
    deepStrictEqual(await kv1.get("hello"), "friend3");
    deepStrictEqual(await kv1.get("empty"), undefined);

    const all2: any[] = [];
    for await (const keyValue of kv2.iterator()) all2.push(keyValue);
    deepStrictEqual(
      all2.map((e) => ({ key: e.key, value: e.value })),
      [
        { key: "init", value: true },
        { key: "hello", value: "friend3" },
      ]
    );

    const all1: any[] = [];
    for await (const keyValue of kv1.iterator()) all1.push(keyValue);
    deepStrictEqual(
      all1.map((e) => ({ key: e.key, value: e.value })),
      [
        { key: "init", value: true },
        { key: "hello", value: "friend3" },
      ]
    );
  });

  it("indexes the database correctly", async () => {
    let replicated1 = false;
    let replicated2 = false;
    let replicated3 = false;
    let expectedEntryHash1: string | null = null;
    let expectedEntryHash2: string | null = null;
    let expectedEntryHash3: string | null = null;

    const onError = (err: any) => {
      console.error(err);
      deepStrictEqual(err, undefined);
    };

    const onUpdate = (entry: any) => {
      replicated1 =
        expectedEntryHash1 !== null && entry.hash === expectedEntryHash1;
    };

    kv1 = await KeyValueIndexed()({
      ipfs: ipfs1,
      identity: testIdentity1,
      address: databaseId,
      accessController,
      directory: "./orbitdb1",
    });
    kv2 = await KeyValueIndexed()({
      ipfs: ipfs2,
      identity: testIdentity2,
      address: databaseId,
      accessController,
      directory: "./orbitdb2",
    });

    kv2.events.on("update", onUpdate);
    kv2.events.on("error", onError);
    kv1.events.on("error", onError);

    await kv1.set("init", true);
    await kv1.set("hello", "friend");
    await kv1.del("hello");
    await kv1.set("hello", "friend2");
    await kv1.del("hello");
    await kv1.set("empty", "");
    await kv1.del("empty");
    expectedEntryHash1 = await kv1.set("hello", "friend3");

    await waitFor(
      () => replicated1,
      () => true
    );

    await kv1.close();

    await kv2.set("A", "AAA");
    await kv2.set("B", "BBB");
    expectedEntryHash3 = await kv2.set("C", "CCC");

    await kv2.close();

    kv1 = await KeyValueIndexed()({
      ipfs: ipfs1,
      identity: testIdentity1,
      address: databaseId,
      accessController,
      directory: "./orbitdb1",
    });

    const onUpdate3 = async (entry: EntryType) => {
      replicated3 = Boolean(
        expectedEntryHash3 && entry.hash === expectedEntryHash3
      );
    };

    kv1.events.on("update", onUpdate3);
    kv1.events.on("error", onError);

    await kv1.set("one", 1);
    await kv1.set("two", 2);
    await kv1.set("three", 3);
    await kv1.del("three");
    expectedEntryHash2 = await kv1.set("four", 4);

    kv2 = await KeyValueIndexed()({
      ipfs: ipfs2,
      identity: testIdentity2,
      address: databaseId,
      accessController,
      directory: "./orbitdb2",
    });

    const onUpdate2 = (entry: EntryType) => {
      replicated2 = Boolean(
        expectedEntryHash2 && entry.hash === expectedEntryHash2
      );
    };

    kv2.events.on("update", onUpdate2);
    kv2.events.on("error", onError);

    await waitFor(
      () => replicated2 && replicated3,
      () => true
    );

    const all1: any[] = [];
    for await (const keyValue of kv1.iterator()) all1.push(keyValue);

    const all2: any[] = [];
    for await (const keyValue of kv2.iterator()) all2.push(keyValue);

    deepStrictEqual(
      all2.map((e) => ({ key: e.key, value: e.value })),
      [
        { key: "two", value: 2 },
        { key: "one", value: 1 },
        { key: "init", value: true },
        { key: "hello", value: "friend3" },
        { key: "four", value: 4 },
        { key: "C", value: "CCC" },
        { key: "B", value: "BBB" },
        { key: "A", value: "AAA" },
      ]
    );

    deepStrictEqual(
      all1.map((e) => ({ key: e.key, value: e.value })),
      [
        { key: "two", value: 2 },
        { key: "one", value: 1 },
        { key: "init", value: true },
        { key: "hello", value: "friend3" },
        { key: "four", value: 4 },
        { key: "C", value: "CCC" },
        { key: "B", value: "BBB" },
        { key: "A", value: "AAA" },
      ]
    );
  });

  it("indexes deletes correctly", async () => {
    const databaseId = "kv-CCC";
    let replicated = false;
    let err: any;

    const onError = (error: any) => {
      err = error;
    };

    kv1 = await KeyValueIndexed()({
      ipfs: ipfs1,
      identity: testIdentity1,
      address: databaseId,
      accessController,
      directory: "./orbitdb11",
    });
    kv1.events.on("error", onError);

    await kv1.set("init", true);
    await kv1.set("hello", "friend");
    await kv1.del("delete");
    await kv1.set("delete", "this value");
    await kv1.del("delete");

    kv2 = await KeyValueIndexed()({
      ipfs: ipfs2,
      identity: testIdentity2,
      address: databaseId,
      accessController,
      directory: "./orbitdb22",
    });

    kv2.events.on("join", () => {
      replicated = true;
    });
    kv2.events.on("error", onError);

    await waitFor(
      () => replicated,
      () => true
    );

    const all1: any[] = [];
    for await (const keyValue of kv1.iterator()) all1.push(keyValue);

    const all2: any[] = [];
    for await (const keyValue of kv2.iterator()) all2.push(keyValue);

    deepStrictEqual(err, undefined);
    deepStrictEqual(
      all2.map((e) => ({ key: e.key, value: e.value })),
      [
        { key: "init", value: true },
        { key: "hello", value: "friend" },
      ]
    );
    deepStrictEqual(
      all1.map((e) => ({ key: e.key, value: e.value })),
      [
        { key: "init", value: true },
        { key: "hello", value: "friend" },
      ]
    );

    await rimraf("./orbitdb11");
    await rimraf("./orbitdb22");
  });
});

import { describe, it, beforeEach, afterEach, expect } from "vitest";
import { rimraf } from "rimraf";
import { copy } from "fs-extra";
import { Database, KeyStore, Identities } from "../src/index";
import testKeysPath from "./fixtures/test-keys-path";
import connectPeers from "./utils/connect-nodes";
import waitFor from "./utils/wait-for";
import ComposedStorage from "../src/storage/composed";
import IPFSBlockStorage from "../src/storage/ipfs-block";
import MemoryStorage from "../src/storage/memory";
import createHelia from "./utils/create-helia";
import type { Helia } from "helia";

const keysPath = "./testkeys";

describe("Database - Replication", () => {
  let ipfs1: Helia, ipfs2: Helia;
  let keystore: any;
  let identities: any;
  let testIdentity1: any, testIdentity2: any;
  let db1: any, db2: any;

  const databaseId = "documents-AAA";

  const accessController = {
    canAppend: async (entry: any) => {
      const identity1 = await identities.getIdentity(entry.identity);
      const identity2 = await identities.getIdentity(entry.identity);
      return (
        identity1.id === testIdentity1.id || identity2.id === testIdentity2.id
      );
    },
  };

  beforeEach(async () => {
    [ipfs1, ipfs2] = await Promise.all([createHelia(), createHelia()]);

    await connectPeers(ipfs1, ipfs2);

    await copy(testKeysPath, keysPath);
    keystore = await KeyStore({ path: keysPath });
    identities = await Identities({ keystore });
    testIdentity1 = await identities.createIdentity({ id: "userA" });
    testIdentity2 = await identities.createIdentity({ id: "userB" });
  });

  afterEach(async () => {
    if (db1) {
      await db1.drop();
      await db1.close();
      await rimraf("./orbitdb1");
    }
    if (db2) {
      await db2.drop();
      await db2.close();
      await rimraf("./orbitdb2");
    }

    if (ipfs1) await ipfs1.stop();
    if (ipfs2) await ipfs2.stop();
    if (keystore) await keystore.close();

    await rimraf(keysPath);
    await rimraf("./ipfs1");
    await rimraf("./ipfs2");
  });

  describe("Replicate across peers", () => {
    beforeEach(async () => {
      db1 = await Database({
        ipfs: ipfs1,
        identity: testIdentity1,
        address: databaseId,
        accessController,
        directory: "./orbitdb1",
      });
    });

    it("replicates databases across two peers", async () => {
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

      db2 = await Database({
        ipfs: ipfs2,
        identity: testIdentity2,
        address: databaseId,
        accessController,
        directory: "./orbitdb2",
      });

      db2.events.on("join", onConnected);
      db2.events.on("update", onUpdate);

      await db1.addOperation({ op: "PUT", key: 1, value: "record 1 on db 1" });
      await db1.addOperation({ op: "PUT", key: 2, value: "record 2 on db 1" });
      await db1.addOperation({ op: "PUT", key: 3, value: "record 3 on db 1" });
      expectedEntryHash = await db1.addOperation({
        op: "PUT",
        key: 4,
        value: "record 4 on db 1",
      });

      await waitFor(
        () => replicated,
        () => true
      );

      const all1: any[] = [];
      for await (const item of db1.log.iterator()) all1.unshift(item);

      const all2: any[] = [];
      for await (const item of db2.log.iterator()) all2.unshift(item);

      expect(all1).toEqual(all2);
    });

    // Additional tests can be updated similarly, e.g., "with delays" or "before db2 is instantiated"
  });

  describe("Options", () => {
    it("uses given ComposedStorage with MemoryStorage/IPFSBlockStorage for entryStorage", async () => {
      const storage1 = await ComposedStorage(
        await MemoryStorage(),
        await IPFSBlockStorage({ ipfs: ipfs1, pin: true })
      );
      const storage2 = await ComposedStorage(
        await MemoryStorage(),
        await IPFSBlockStorage({ ipfs: ipfs2, pin: true })
      );

      db1 = await Database({
        ipfs: ipfs1,
        identity: testIdentity1,
        address: databaseId,
        accessController,
        directory: "./orbitdb1",
        entryStorage: storage1,
      });

      db2 = await Database({
        ipfs: ipfs2,
        identity: testIdentity2,
        address: databaseId,
        accessController,
        directory: "./orbitdb2",
        entryStorage: storage2,
      });

      let connected = false;
      db2.events.on("join", () => {
        connected = true;
      });

      await db1.addOperation({ op: "PUT", key: 1, value: "record 1 on db 1" });
      await db1.addOperation({ op: "PUT", key: 2, value: "record 2 on db 1" });
      await db1.addOperation({ op: "PUT", key: 3, value: "record 3 on db 1" });
      await db1.addOperation({ op: "PUT", key: 4, value: "record 4 on db 1" });

      await waitFor(
        () => connected,
        () => true
      );

      const all1: any[] = [];
      for await (const item of db1.log.iterator()) all1.unshift(item);

      const all2: any[] = [];
      for await (const item of db2.log.iterator()) all2.unshift(item);

      expect(all1).toEqual(all2);
    });
  });
});

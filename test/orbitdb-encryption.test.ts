import { describe, it, beforeAll, afterAll, afterEach, expect } from "vitest";
import { rimraf } from "rimraf";
import path from "path";
import { createOrbitDB } from "../src/index";
import connectPeers from "./utils/connect-nodes";
import waitFor from "./utils/wait-for";
import createHelia from "./utils/create-helia";

import * as Block from "multiformats/block";
import * as dagCbor from "@ipld/dag-cbor";
import { sha256 } from "multiformats/hashes/sha2";

import SimpleEncryption from "@orbitdb/simple-encryption";

const codec = dagCbor;
const hasher = sha256;

const dbPath = "./orbitdb/tests/write-permissions";

describe("Encryption", () => {
  let ipfs1: any, ipfs2: any;
  let orbitdb1: any, orbitdb2: any;
  let db1: any, db2: any;
  let replicationEncryption: any;
  let dataEncryption: any;

  beforeAll(async () => {
    [ipfs1, ipfs2] = await Promise.all([createHelia(), createHelia()]);
    await connectPeers(ipfs1, ipfs2);

    await rimraf("./orbitdb");

    orbitdb1 = await createOrbitDB({
      ipfs: ipfs1,
      id: "user1",
      directory: path.join(dbPath, "1"),
    });
    orbitdb2 = await createOrbitDB({
      ipfs: ipfs2,
      id: "user2",
      directory: path.join(dbPath, "2"),
    });

    replicationEncryption = await SimpleEncryption({ password: "hello" });
    dataEncryption = await SimpleEncryption({ password: "world" });
  });

  afterAll(async () => {
    if (orbitdb1) await orbitdb1.stop();
    if (orbitdb2) await orbitdb2.stop();
    if (ipfs1) await ipfs1.stop();
    if (ipfs2) await ipfs2.stop();

    await rimraf("./orbitdb");
    await rimraf("./ipfs1");
    await rimraf("./ipfs2");
  });

  describe("Data is encrypted when replicated to peers", () => {
    afterEach(async () => {
      if (db1) {
        await db1.drop();
        await db1.close();
      }
      if (db2) {
        await db2.drop();
        await db2.close();
      }
    });

    it("encrypts/decrypts data", async () => {
      let connected = false;
      let updated = false;
      let error = false;

      const encryption = { data: dataEncryption };

      db1 = await orbitdb1.open("encryption-test-1", { encryption });
      db2 = await orbitdb2.open(db1.address, { encryption });

      db2.events.on("join", async () => {
        connected = true;
      });
      await waitFor(
        () => connected,
        () => true
      );

      db2.events.on("update", async () => {
        updated = true;
      });
      db2.events.on("error", async () => {
        error = true;
      });

      const hash1 = await db1.add("record 1");
      const hash2 = await db1.add("record 2");

      expect(await db1.get(hash1)).toBe("record 1");
      expect(await db1.get(hash2)).toBe("record 2");

      await waitFor(
        () => updated || error,
        () => true
      );

      const all = await db2.all();
      expect(all.length).toBe(2);
      expect(all[0].value).toBe("record 1");
      expect(all[1].value).toBe("record 2");
    });

    it("encrypts/decrypts log", async () => {
      let connected = false;
      let updated = false;
      let error = false;

      const encryption = { replication: replicationEncryption };

      db1 = await orbitdb1.open("encryption-test-1", { encryption });
      db2 = await orbitdb2.open(db1.address, { encryption });

      db2.events.on("join", async () => {
        connected = true;
      });
      await waitFor(
        () => connected,
        () => true
      );

      db2.events.on("update", async () => {
        updated = true;
      });
      db2.events.on("error", async () => {
        error = true;
      });

      const hash1 = await db1.add("record 1");
      const hash2 = await db1.add("record 2");

      expect(await db1.get(hash1)).toBe("record 1");
      expect(await db1.get(hash2)).toBe("record 2");

      await waitFor(
        () => updated || error,
        () => true
      );

      const all = await db2.all();
      expect(all.length).toBe(2);
      expect(all[0].value).toBe("record 1");
      expect(all[1].value).toBe("record 2");
    });

    it("encrypts/decrypts log and data", async () => {
      let connected = false;
      let updated = false;
      let error = false;

      const encryption = {
        replication: replicationEncryption,
        data: dataEncryption,
      };

      db1 = await orbitdb1.open("encryption-test-1", { encryption });
      db2 = await orbitdb2.open(db1.address, { encryption });

      db2.events.on("join", async () => {
        connected = true;
      });
      await waitFor(
        () => connected,
        () => true
      );

      db2.events.on("update", async () => {
        updated = true;
      });
      db2.events.on("error", async () => {
        error = true;
      });

      const hash1 = await db1.add("record 1");
      const hash2 = await db1.add("record 2");

      expect(await db1.get(hash1)).toBe("record 1");
      expect(await db1.get(hash2)).toBe("record 2");

      await waitFor(
        () => updated || error,
        () => true
      );

      const all = await db2.all();
      expect(all.length).toBe(2);
      expect(all[0].value).toBe("record 1");
      expect(all[1].value).toBe("record 2");
    });

    it("throws an error if log can't be decrypted", async () => {
      let connected = false;
      let hasError = false;
      let error: any;

      const replicationEncryptionWithFailure = await SimpleEncryption({
        password: "goodbye",
      });

      const encryption = { replication: replicationEncryption };
      const encryptionWithFailure = {
        replication: replicationEncryptionWithFailure,
      };

      db1 = await orbitdb1.open("encryption-test-1", { encryption });
      db2 = await orbitdb2.open(db1.address, {
        encryption: encryptionWithFailure,
      });

      db2.events.on("join", async () => {
        connected = true;
      });
      await waitFor(
        () => connected,
        () => true
      );

      db2.events.on("error", (err: any) => {
        error = err;
        hasError = true;
      });

      await db1.add("record 1");
      await waitFor(
        () => hasError,
        () => true
      );

      expect(error.message).toBe("Could not decrypt entry");
      const all = await db2.all();
      expect(all.length).toBe(0);
    });

    it("throws an error if data can't be decrypted", async () => {
      let connected = false;
      let hasError = false;
      let error: any;

      const dataEncryptionWithFailure = await SimpleEncryption({
        password: "goodbye",
      });

      const encryption = { data: dataEncryption };
      const encryptionWithFailure = { data: dataEncryptionWithFailure };

      db1 = await orbitdb1.open("encryption-test-1", { encryption });
      db2 = await orbitdb2.open(db1.address, {
        encryption: encryptionWithFailure,
      });

      db2.events.on("join", async () => {
        connected = true;
      });
      await waitFor(
        () => connected,
        () => true
      );

      db2.events.on("error", (err: any) => {
        error = err;
        hasError = true;
      });

      await db1.add("record 1");
      await waitFor(
        () => hasError,
        () => true
      );

      expect(error.message).toBe("Could not decrypt payload");
      const all = await db2.all();
      expect(all.length).toBe(0);
    });
  });

  describe("Data is encrypted in storage", () => {
    afterEach(async () => {
      if (db1) {
        await db1.drop();
        await db1.close();
      }
    });

    it("payload bytes are encrypted in storage", async () => {
      let error: any;

      type EntityType = {
        payload: Uint8Array | unknown;
        [key: string]: unknown;
      };

      const encryption = { data: dataEncryption };
      db1 = await orbitdb1.open("encryption-test-1", { encryption });

      db1.events.on("error", async (err: any) => {
        error = err;
      });

      const hash1 = await db1.add("record 1");
      const bytes = await db1.log.storage.get(hash1);

      // Decode the entry block
      const { value } = await Block.decode<
        EntityType,
        typeof codec.code,
        typeof hasher.code
      >({ bytes, codec, hasher });

      const payload = value.payload;

      // Ensure payload is Uint8Array
      expect(payload).toBeInstanceOf(Uint8Array);

      try {
        // TypeScript-safe cast: we know payload is Uint8Array
        await Block.decode({
          bytes: payload as Uint8Array,
          codec,
          hasher,
        });
      } catch (e: any) {
        error = e;
      }

      expect(error.message.startsWith("CBOR decode error")).toBe(true);
    });

    it("entry bytes are encrypted in storage", async () => {
      let error: any;
      let decodedBytes: any;

      const encryption = { replication: replicationEncryption };
      db1 = await orbitdb1.open("encryption-test-1", { encryption });

      db1.events.on("error", async (err: any) => {
        error = err;
      });

      const hash1 = await db1.add("record 1");

      try {
        const bytes = await db1.log.storage.get(hash1);
        decodedBytes = await Block.decode({ bytes, codec, hasher });
        await Block.decode({ bytes: decodedBytes, codec, hasher });
      } catch (e: any) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.message.startsWith("CBOR decode error")).toBe(true);
      expect(decodedBytes.value.constructor).toBe(Uint8Array);
    });
  });
});

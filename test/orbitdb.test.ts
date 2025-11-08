import { strictEqual, notStrictEqual } from "assert";
import { rimraf } from "rimraf";
import fs from "fs";
import path from "path";
import {
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import { createOrbitDB, isIdentity } from "../src/index.js";
import connectPeers from "./utils/connect-nodes.js";
import createHelia from "./utils/create-helia.js";

const isBrowser = () => typeof window !== "undefined";

describe("OrbitDB", () => {
  let ipfs1: any, ipfs2: any;
  let orbitdb1: any;

  beforeAll(async () => {
    [ipfs1, ipfs2] = await Promise.all([createHelia(), createHelia()]);
    await connectPeers(ipfs1, ipfs2);
  });

  afterAll(async () => {
    if (ipfs1) await ipfs1.stop();
    if (ipfs2) await ipfs2.stop();
    await rimraf("./ipfs1");
    await rimraf("./ipfs2");
  });

  describe("OrbitDB instance creation - defaults", () => {
    beforeAll(async () => {
      await rimraf("./orbitdb");
      orbitdb1 = await createOrbitDB({ ipfs: ipfs1 });
    });

    afterAll(async () => {
      if (orbitdb1) await orbitdb1.stop();
      await rimraf("./orbitdb");
    });

    it("has an IPFS instance", async () => {
      notStrictEqual(orbitdb1.ipfs, undefined);
      strictEqual(typeof orbitdb1.ipfs, "object");
    });

    it("has the IPFS instance given as a parameter", async () => {
      const { id: expectedId } = ipfs1.libp2p.peerId;
      const { id: resultId } = orbitdb1.ipfs.libp2p.peerId;
      strictEqual(expectedId, resultId);
    });

    it("has a directory", async () => {
      notStrictEqual(orbitdb1.directory, undefined);
      strictEqual(typeof orbitdb1.directory, "string");
    });

    it("has the directory given as a parameter", async () => {
      strictEqual(orbitdb1.directory, "./orbitdb");
    });

    it("has a keystore", async () => {
      notStrictEqual(orbitdb1.keystore, undefined);
      strictEqual(typeof orbitdb1.keystore, "object");
    });

    it("has a keystore that contains a private key for the created identity", async () => {
      const privateKey = await orbitdb1.keystore.getKey(orbitdb1.identity.id);
      notStrictEqual(privateKey, undefined);
      strictEqual(privateKey.constructor.name, "Secp256k1PrivateKey");
      notStrictEqual(privateKey.raw, undefined);
      notStrictEqual(privateKey.publicKey, undefined);
    });

    it("has a keystore that contains a public key that matches the identity's public key", async () => {
      const privateKey = await orbitdb1.keystore.getKey(orbitdb1.identity.id);
      const publicKey = await orbitdb1.keystore.getPublic(privateKey);
      notStrictEqual(publicKey, undefined);
      strictEqual(typeof publicKey, "string");
      strictEqual(publicKey, orbitdb1.identity.publicKey);
    });

    it("creates a directory for the keystore", async () => {
      const directoryExists = fs.existsSync(path.join("./orbitdb/keystore"));
      strictEqual(directoryExists, true);
    });

    it("has an identity", async () => {
      notStrictEqual(orbitdb1.identity, undefined);
      strictEqual(typeof orbitdb1.identity, "object");
    });

    it("creates a valid identity", async () => {
      strictEqual(isIdentity(orbitdb1.identity), true);
    });

    it("has a peerId", async () => {
      notStrictEqual(orbitdb1.peerId, undefined);
    });

    it("has a peerId of type Ed25519", async () => {
      strictEqual(orbitdb1.peerId.type, "Ed25519");
    });

    it("has a peerId that matches the IPFS id", async () => {
      const id = ipfs1.libp2p.peerId;
      strictEqual(orbitdb1.peerId, id);
    });

    it("has an open function", async () => {
      notStrictEqual(orbitdb1.open, undefined);
      strictEqual(typeof orbitdb1.open, "function");
    });

    it("has a stop function", async () => {
      notStrictEqual(orbitdb1.stop, undefined);
      strictEqual(typeof orbitdb1.stop, "function");
    });
  });

  describe("OrbitDB instance creation - user given parameters", () => {
    beforeAll(async () => {
      await rimraf("./orbitdb1");
      orbitdb1 = await createOrbitDB({
        ipfs: ipfs1,
        id: "user1",
        directory: "./orbitdb1",
      });
    });

    afterAll(async () => {
      if (orbitdb1) await orbitdb1.stop();
      await rimraf("./orbitdb1");
    });

    it("has an IPFS instance", async () => {
      notStrictEqual(orbitdb1.ipfs, undefined);
      strictEqual(typeof orbitdb1.ipfs, "object");
    });

    it("has the IPFS instance given as a parameter", async () => {
      const { id: expectedId } = ipfs1.libp2p.peerId;
      const { id: resultId } = orbitdb1.ipfs.libp2p.peerId;
      strictEqual(expectedId, resultId);
    });

    it("has a directory", async () => {
      notStrictEqual(orbitdb1.directory, undefined);
      strictEqual(typeof orbitdb1.directory, "string");
    });

    it("has the directory given as a parameter", async () => {
      strictEqual(orbitdb1.directory, "./orbitdb1");
    });

    it("has a keystore", async () => {
      notStrictEqual(orbitdb1.keystore, undefined);
      strictEqual(typeof orbitdb1.keystore, "object");
    });

    it("has a keystore that contains a private key for the created identity", async () => {
      const privateKey = await orbitdb1.keystore.getKey(orbitdb1.identity.id);
      notStrictEqual(privateKey, undefined);
      strictEqual(privateKey.constructor.name, "Secp256k1PrivateKey");
      notStrictEqual(privateKey.raw, undefined);
      notStrictEqual(privateKey.publicKey, undefined);
    });

    it("has a keystore that contains a public key that matches the identity's public key", async () => {
      const privateKey = await orbitdb1.keystore.getKey(orbitdb1.identity.id);
      const publicKey = await orbitdb1.keystore.getPublic(privateKey);
      notStrictEqual(publicKey, undefined);
      strictEqual(typeof publicKey, "string");
      strictEqual(publicKey, orbitdb1.identity.publicKey);
    });

    it("creates a directory for the keystore", async () => {
      const directoryExists = fs.existsSync(path.join("./orbitdb1/keystore"));
      strictEqual(directoryExists, true);
    });

    it("has an identity", async () => {
      notStrictEqual(orbitdb1.identity, undefined);
      strictEqual(typeof orbitdb1.identity, "object");
    });

    it("creates a valid identity", async () => {
      strictEqual(isIdentity(orbitdb1.identity), true);
    });

    it("has a peerId", async () => {
      notStrictEqual(orbitdb1.peerId, undefined);
    });

    it("has a peerId of type Ed25519", async () => {
      strictEqual(orbitdb1.peerId.type, "Ed25519");
    });

    it("has a peerId that matches the IPFS id", async () => {
      const id = ipfs1.libp2p.peerId;
      strictEqual(orbitdb1.peerId, id);
    });

    it("has an open function", async () => {
      notStrictEqual(orbitdb1.open, undefined);
      strictEqual(typeof orbitdb1.open, "function");
    });

    it("has a stop function", async () => {
      notStrictEqual(orbitdb1.stop, undefined);
      strictEqual(typeof orbitdb1.stop, "function");
    });
  });

  describe("OrbitDB instance creation - errors", () => {
    afterAll(async () => {
      if (orbitdb1) await orbitdb1.stop();
    });

    it("throws an error if given an empty parameters object", async () => {
      let err: any;
      try {
        orbitdb1 = await createOrbitDB({});
      } catch (e) {
        err = e;
      }
      notStrictEqual(err, undefined);
      strictEqual(err.message, "IPFS instance is a required argument.");
    });

    it("throws an error if IPFS instance is not given", async () => {
      let err: any;
      try {
        orbitdb1 = await createOrbitDB();
      } catch (e) {
        err = e;
      }
      notStrictEqual(err, undefined);
      strictEqual(err.message, "IPFS instance is a required argument.");
    });

    it("doesn't create the data directory when an error occurs", async () => {
      if (isBrowser()) return;

      try {
        orbitdb1 = await createOrbitDB();
      } catch (e) {}

      const dataDirectoryExists = fs.existsSync(path.join("./orbitdb"));
      const keysDirectoryExists = fs.existsSync(
        path.join("./orbitdb/keystore")
      );
      strictEqual(dataDirectoryExists, false);
      strictEqual(keysDirectoryExists, false);
    });
  });
});

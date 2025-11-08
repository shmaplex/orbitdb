import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { rimraf } from "rimraf";
import type { Helia } from "helia";
import type { KeyStoreInstance } from "../../src/key-store";
import type {
  IdentitiesInstance,
  IdentityType as Identity,
} from "../../src/identities";
import Keystore from "../../src/key-store";
import Identities from "../../src/identities/identities";
import IPFSAccessController from "../../src/access-controllers/ipfs";
import connectPeers from "../utils/connect-nodes";
import createHelia from "../utils/create-helia";

describe("IPFSAccessController", () => {
  const dbPath1 = "./orbitdb/tests/ipfs-access-controller/1";
  const dbPath2 = "./orbitdb/tests/ipfs-access-controller/2";

  let ipfs1: Helia;
  let ipfs2: Helia;
  let keystore1: KeyStoreInstance;
  let keystore2: KeyStoreInstance;
  let identities1: IdentitiesInstance;
  let identities2: IdentitiesInstance;
  let testIdentity1: Identity;
  let testIdentity2: Identity;
  let orbitdb1: { ipfs: Helia; identity: Identity };
  let orbitdb2: { ipfs: Helia; identity: Identity };
  let accessController: any;

  beforeAll(async () => {
    [ipfs1, ipfs2] = await Promise.all([createHelia(), createHelia()]);
    await connectPeers(ipfs1, ipfs2);

    keystore1 = await Keystore({ path: dbPath1 + "/keys" });
    keystore2 = await Keystore({ path: dbPath2 + "/keys" });

    identities1 = await Identities({ keystore: keystore1 });
    identities2 = await Identities({ keystore: keystore2 });

    testIdentity1 = await identities1.createIdentity({ id: "userA" });
    testIdentity2 = await identities2.createIdentity({ id: "userB" });

    orbitdb1 = { ipfs: ipfs1, identity: testIdentity1 };
    orbitdb2 = { ipfs: ipfs2, identity: testIdentity2 };
  });

  afterAll(async () => {
    if (ipfs1) await ipfs1.stop();
    if (ipfs2) await ipfs2.stop();
    if (keystore1) await keystore1.close();
    if (keystore2) await keystore2.close();

    await rimraf("./orbitdb");
    await rimraf("./ipfs1");
    await rimraf("./ipfs2");
  });

  describe("Default write access", () => {
    beforeAll(async () => {
      accessController = await IPFSAccessController({
        orbitdb: orbitdb1,
        identities: identities1,
      });
    });

    it("creates an access controller", () => {
      expect(accessController).not.toBeNull();
      expect(accessController).not.toBeUndefined();
    });

    it("sets the controller type", () => {
      expect(accessController.type).toBe("ipfs");
    });

    it("sets default write", async () => {
      expect(accessController.write).toEqual([testIdentity1.id]);
    });

    it("user with write access can append", async () => {
      const mockEntry = { identity: testIdentity1.hash, v: 1 };
      const canAppend = await accessController.canAppend(mockEntry);
      expect(canAppend).toBe(true);
    });

    it("user without write cannot append", async () => {
      const mockEntry = { identity: testIdentity2.hash, v: 1 };
      const canAppend = await accessController.canAppend(mockEntry);
      expect(canAppend).toBe(false);
    });

    it("replicates the access controller", async () => {
      const replicated = await IPFSAccessController({
        orbitdb: orbitdb2,
        identities: identities2,
        address: accessController.address,
      });
      expect(replicated.type).toBe(accessController.type);
      expect(replicated.address).toBe(accessController.address);
      expect(replicated.write).toEqual(accessController.write);
    });
  });

  describe("Write all access", () => {
    beforeAll(async () => {
      accessController = await IPFSAccessController({
        orbitdb: orbitdb1,
        identities: identities1,
        write: ["*"],
      });
    });

    it("sets write to 'Anyone'", async () => {
      expect(accessController.write).toEqual(["*"]);
    });
  });
});

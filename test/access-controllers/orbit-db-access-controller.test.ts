import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { strictEqual, deepStrictEqual, notStrictEqual } from "assert";
import { rimraf } from "rimraf";
import type { Helia } from "helia";
import type { KeyStoreInstance } from "../../src/key-store";
import type {
  IdentitiesInstance,
  IdentityType as Identity,
} from "../../src/identities";
import Keystore from "../../src/key-store";
import Identities from "../../src/identities/identities";
import OrbitDBAccessController from "../../src/access-controllers/orbitdb";
import connectPeers from "../utils/connect-nodes";
import createHelia from "../utils/create-helia";

describe("OrbitDBAccessController", () => {
  const dbPath1 = "./orbitdb/tests/orbitdb-access-controller/1";
  const dbPath2 = "./orbitdb/tests/orbitdb-access-controller/2";

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
      accessController = await OrbitDBAccessController({
        orbitdb: orbitdb1,
        identities: identities1,
      });
    });

    it("creates an access controller", () => {
      notStrictEqual(accessController, null);
      notStrictEqual(accessController, undefined);
    });

    it("sets the controller type", () => {
      strictEqual(accessController.type, "orbitdb");
    });

    it("sets default admin capability", async () => {
      const capabilities = await accessController.capabilities();
      const expected: any = [];
      expected.admin = new Set([testIdentity1.id]);
      deepStrictEqual(capabilities, expected);
    });

    it("allows owner to append", async () => {
      const mockEntry = { identity: testIdentity1.hash };
      const canAppend = await accessController.canAppend(mockEntry);
      strictEqual(canAppend, true);
    });
  });

  describe("grant", () => {
    beforeAll(async () => {
      accessController = await OrbitDBAccessController({
        orbitdb: orbitdb1,
        identities: identities1,
        address: "testdb/add",
      });
    });

    it("adds a capability", async () => {
      await accessController.grant("write", testIdentity1.id);
      const expected: any = [];
      expected.admin = new Set([testIdentity1.id]);
      expected.write = new Set([testIdentity1.id]);
      deepStrictEqual(await accessController.capabilities(), expected);
    });

    it("adds more capabilities", async () => {
      await accessController.grant("read", "ABCD");
      await accessController.grant("delete", "ABCD");
      const expected: any = [];
      expected.admin = new Set([testIdentity1.id]);
      expected.write = new Set([testIdentity1.id]);
      expected.read = new Set(["ABCD"]);
      expected.delete = new Set(["ABCD"]);
      deepStrictEqual(await accessController.capabilities(), expected);
    });

    it("emits 'update' event when a capability is added", async () => {
      let updated = false;
      const onUpdate = () => (updated = true);
      accessController.events.on("update", onUpdate);

      await accessController.grant("read", "AXES");
      strictEqual(updated, true);
    });

    it("allows append after granting capability", async () => {
      await accessController.grant("write", testIdentity2.id);
      const mockEntry = { identity: testIdentity2.hash };
      const canAppend = await accessController.canAppend(mockEntry);
      strictEqual(canAppend, true);
    });
  });

  describe("revoke", () => {
    beforeAll(async () => {
      accessController = await OrbitDBAccessController({
        orbitdb: orbitdb1,
        identities: identities1,
        address: "testdb/remove",
      });
    });

    it("removes a capability", async () => {
      await accessController.grant("write", testIdentity1.id);
      await accessController.grant("write", "AABB");
      await accessController.revoke("write", "AABB");

      const expected: any = [];
      expected.admin = new Set([testIdentity1.id]);
      expected.write = new Set([testIdentity1.id]);
      deepStrictEqual(await accessController.capabilities(), expected);
    });

    it("cannot remove creator’s admin access", async () => {
      await accessController.revoke("admin", testIdentity1.id);
      const expected: any = [];
      expected.admin = new Set([testIdentity1.id]);
      deepStrictEqual(await accessController.capabilities(), expected);
    });

    it("emits 'update' when a capability is removed", async () => {
      await accessController.grant("admin", "cats");
      await accessController.grant("admin", "dogs");

      let updated = false;
      accessController.events.on("update", () => (updated = true));

      await accessController.revoke("admin", "cats");
      strictEqual(updated, true);
    });

    it("prevents append after revoking", async () => {
      await accessController.grant("write", testIdentity2.id);
      await accessController.revoke("write", testIdentity2.id);

      const canAppend = await accessController.canAppend({
        identity: testIdentity1.hash,
      });
      const noAppend = await accessController.canAppend({
        identity: testIdentity2.hash,
      });

      strictEqual(canAppend, true);
      strictEqual(noAppend, false);
    });
  });
});

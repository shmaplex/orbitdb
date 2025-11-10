import {
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  expect,
} from "vitest";
import { rimraf } from "rimraf";
import { existsSync } from "fs";
import { copy } from "fs-extra";
import Path from "path";
import { Database, KeyStore, Identities } from "../src/index.js";
import LevelStorage from "../src/storage/level.js";
import MemoryStorage from "../src/storage/memory.js";
import testKeysPath from "./fixtures/test-keys-path.js";
import { createHeliaNode as createHelia } from "./utils/create-helia";

const keysPath = "./testkeys";

describe("Database", () => {
  let ipfs: any;
  let keystore: any;
  let identities: any;
  let testIdentity: any;
  let db: any;

  const databaseId = "database-AAA";

  const accessController = {
    canAppend: async (entry: any) => {
      const identity1 = await identities.getIdentity(entry.identity);
      return identity1.id === testIdentity.id;
    },
  };

  beforeAll(async () => {
    ipfs = await createHelia();
    await copy(testKeysPath, keysPath);
    keystore = await KeyStore({ path: keysPath });
    identities = await Identities({ keystore });
    testIdentity = await identities.createIdentity({ id: "userA" });
  });

  afterAll(async () => {
    if (ipfs) await ipfs.stop();
    if (keystore) await keystore.close();
    await rimraf(keysPath);
    await rimraf("./ipfs1");
  });

  afterEach(async () => {
    await rimraf("./orbitdb");
  });

  it("adds an operation", async () => {
    db = await Database({
      ipfs,
      identity: testIdentity,
      address: databaseId,
      access: accessController,
      directory: "./orbitdb",
    });
    const expected = "zdpuAwhx6xVpnMPUA7Q4JrvZsyoti5wZ18iDeFwBjPAwsRNof";
    const op = { op: "PUT", key: 1, value: "record 1 on db 1" };
    const actual = await db.addOperation(op);

    expect(actual).toEqual(expected);
    await db.close();
  });

  describe("Options", () => {
    it("uses default directory for headsStorage", async () => {
      db = await Database({
        ipfs,
        identity: testIdentity,
        address: databaseId,
        access: accessController,
      });

      const op1 = { op: "PUT", key: 1, value: "record 1 on db 1 version 1" };
      const op2 = { op: "PUT", key: 1, value: "record 1 on db 1 version 2" };

      await db.addOperation(op1);
      const hash = await db.addOperation(op2);
      const entry = await db.log.get(hash);

      const headsPath = Path.join(
        "./orbitdb/",
        `${databaseId}/`,
        "/log/_heads/"
      );
      expect(existsSync(headsPath)).toBe(true);

      await db.close();

      const headsStorage = await LevelStorage({ path: headsPath });
      const bytes = await headsStorage.get("heads");
      const heads = JSON.parse(new TextDecoder().decode(bytes));

      expect(heads.length).toBe(1);
      expect(heads.at(0)?.hash).toBe(hash);
      expect(heads.at(0)?.next.length).toBe(1);
      expect(heads.at(0)?.next.at(0)).toBe(entry.next.at(0));

      await headsStorage.close();
      await rimraf(headsPath);
    });

    it("uses given directory for headsStorage", async () => {
      db = await Database({
        ipfs,
        identity: testIdentity,
        address: databaseId,
        access: accessController,
        directory: "./custom-directory",
      });
      const op1 = { op: "PUT", key: 1, value: "record 1 on db 1 version 1" };
      const op2 = { op: "PUT", key: 1, value: "record 1 on db 1 version 2" };

      await db.addOperation(op1);
      const hash = await db.addOperation(op2);
      const entry = await db.log.get(hash);

      const headsPath = Path.join(
        "./custom-directory/",
        `${databaseId}/`,
        "/log/_heads/"
      );
      expect(existsSync(headsPath)).toBe(true);

      await db.close();
      const headsStorage = await LevelStorage({ path: headsPath });
      const bytes = await headsStorage.get("heads");
      const heads = JSON.parse(new TextDecoder().decode(bytes));

      expect(heads.length).toBe(1);
      expect(heads.at(0)?.hash).toBe(hash);
      expect(heads.at(0)?.next.length).toBe(1);
      expect(heads.at(0)?.next.at(0)).toBe(entry.next.at(0));

      await headsStorage.close();
      await rimraf(headsPath);
      await rimraf("./custom-directory");
    });

    it("uses given MemoryStorage for headsStorage", async () => {
      const headsStorage = await MemoryStorage();
      db = await Database({
        ipfs,
        identity: testIdentity,
        address: databaseId,
        access: accessController,
        directory: "./orbitdb",
        headsStorage,
      });

      const op1 = { op: "PUT", key: 1, value: "record 1 on db 1 version 1" };
      const op2 = { op: "PUT", key: 1, value: "record 1 on db 1 version 2" };

      await db.addOperation(op1);
      const hash = await db.addOperation(op2);
      const entry = await db.log.get(hash);

      const bytes = await headsStorage.get("heads");
      const heads = JSON.parse(new TextDecoder().decode(bytes));

      expect(heads.length).toBe(1);
      expect(heads.at(0)?.hash).toBe(hash);
      expect(heads.at(0)?.next.length).toBe(1);
      expect(heads.at(0)?.next.at(0)).toBe(entry.next.at(0));

      await db.close();
      await headsStorage.close();
      await rimraf("./orbitdb");
    });

    it("uses given MemoryStorage for entryStorage", async () => {
      const entryStorage = await MemoryStorage();
      const headsStorage = await MemoryStorage();
      db = await Database({
        ipfs,
        identity: testIdentity,
        address: databaseId,
        access: accessController,
        directory: "./orbitdb",
        headsStorage,
        entryStorage,
      });

      const op1 = { op: "PUT", key: 1, value: "record 1 on db 1 version 1" };
      const op2 = { op: "PUT", key: 1, value: "record 1 on db 1 version 2" };

      await db.addOperation(op1);
      const hash = await db.addOperation(op2);
      const entry = await db.log.get(hash);

      const bytes = await headsStorage.get("heads");
      const heads = JSON.parse(new TextDecoder().decode(bytes));

      expect(heads.length).toBe(1);
      expect(heads.at(0)?.hash).toBe(hash);
      expect(heads.at(0)?.next.length).toBe(1);
      expect(heads.at(0)?.next.at(0)).toBe(entry.next.at(0));

      await db.close();
      await entryStorage.close();
      await headsStorage.close();
      await rimraf("./orbitdb");
    });
  });

  describe("Events", () => {
    beforeEach(async () => {
      db = await Database({
        ipfs,
        identity: testIdentity,
        address: databaseId,
        access: accessController,
        directory: "./orbitdb",
      });
    });

    it("emits 'close' when the database is closed", async () => {
      let closed = false;
      db.events.on("close", () => {
        closed = true;
      });

      await db.close();
      expect(closed).toBe(true);
    });

    it("emits 'drop' when the database is dropped", async () => {
      let dropped = false;
      db.events.on("drop", () => {
        dropped = true;
      });

      await db.drop();
      expect(dropped).toBe(true);

      await db.close();
    });
  });
});

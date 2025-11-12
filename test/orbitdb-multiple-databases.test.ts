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
import path from "path";
import OrbitDB from "../src/orbitdb";
import connectPeers from "./utils/connect-nodes";
import waitFor from "./utils/wait-for";
import createHelia from "./utils/create-helia";

const dbPath1 = "./orbitdb/tests/multiple-databases/1";
const dbPath2 = "./orbitdb/tests/multiple-databases/2";

const databaseInterfaces = [
  {
    name: "events",
    open: async (orbitdb: any, address: string, options: any) =>
      await orbitdb.open(address, options),
    write: async (db: any, index: number) => {
      await db.add("hello" + index);
    },
    query: async (db: any) => {
      const all = await db.all();
      return all.length;
    },
  },
  {
    name: "key-value",
    open: async (orbitdb: any, address: string, options: any) =>
      await orbitdb.open(address, { ...options, type: "keyvalue" }),
    write: async (db: any, index: number) => await db.put("hello", index),
    query: async (db: any) => await db.get("hello"),
  },
  {
    name: "documents",
    open: async (orbitdb: any, address: string, options: any) =>
      await orbitdb.open(address, { ...options, type: "documents" }),
    write: async (db: any, index: number) =>
      await db.put({ _id: "hello", testing: index }),
    query: async (db: any) => {
      const doc = await db.get("hello");
      return doc ? doc.value.testing : 0;
    },
  },
];

describe("orbitdb - Multiple Databases", () => {
  let ipfs1: any, ipfs2: any;
  let orbitdb1: any, orbitdb2: any;

  const localDatabases: any[] = [];
  const remoteDatabases: any[] = [];

  beforeAll(async () => {
    [ipfs1, ipfs2] = await Promise.all([createHelia(), createHelia()]);
    await connectPeers(ipfs1, ipfs2);

    orbitdb1 = await OrbitDB({ ipfs: ipfs1, id: "user1", directory: dbPath1 });
    orbitdb2 = await OrbitDB({ ipfs: ipfs2, id: "user2", directory: dbPath2 });
  });

  afterAll(async () => {
    if (orbitdb1) await orbitdb1.stop();
    if (orbitdb2) await orbitdb2.stop();

    await rimraf("./orbitdb");

    if (ipfs1) await ipfs1.stop();
    if (ipfs2) await ipfs2.stop();

    await rimraf("./ipfs1");
    await rimraf("./ipfs2");
  });

  beforeEach(async () => {
    let options: any = { write: [orbitdb1.identity.id, orbitdb2.identity.id] };
    let connected1Count = 0;
    let connected2Count = 0;

    const onConnected1 = async () => {
      connected1Count++;
    };
    const onConnected2 = async () => {
      connected2Count++;
    };

    options = { ...options, create: true };

    for (const dbInterface of databaseInterfaces) {
      const db = await dbInterface.open(orbitdb1, dbInterface.name, options);
      db.events.on("join", onConnected1);
      localDatabases.push(db);
    }

    for (const [index, dbInterface] of databaseInterfaces.entries()) {
      const address = localDatabases[index].address.toString();
      const db = await dbInterface.open(orbitdb2, address, options);
      db.events.on("join", onConnected2);
      remoteDatabases.push(db);
    }

    await waitFor(
      () => connected1Count === databaseInterfaces.length,
      () => true
    );
    await waitFor(
      () => connected2Count === databaseInterfaces.length,
      () => true
    );
  });

  afterEach(async () => {
    for (const db of remoteDatabases) {
      await db.drop();
      await db.close();
    }
    for (const db of localDatabases) {
      await db.drop();
      await db.close();
    }
    localDatabases.length = 0;
    remoteDatabases.length = 0;
  });

  it("replicates multiple open databases", async () => {
    const entryCount = 10;

    for (let index = 0; index < databaseInterfaces.length; index++) {
      const dbInterface = databaseInterfaces[index];
      const db = localDatabases[index];
      for (let i = 1; i <= entryCount; i++) {
        await dbInterface.write(db, i);
      }
    }

    const isReplicated = async (db: any) => {
      const all = await db.log.all();
      return all.length === entryCount;
    };

    const allReplicated = async () => {
      for (const db of remoteDatabases) {
        if (!(await isReplicated(db))) return false;
      }
      return true;
    };

    await waitFor(
      async () => await allReplicated(),
      () => true,
      2000
    );

    for (let i = 0; i < databaseInterfaces.length; i++) {
      const db = remoteDatabases[i];
      const result = await databaseInterfaces[i].query(db);
      expect(result).toBe(entryCount);
      expect((await db.log.all()).length).toBe(entryCount);
    }
  });
});

import { strictEqual } from "assert";
import { describe, it, beforeAll, afterAll } from "vitest";
import {
  setupTwoNodes,
  teardownTwoNodes,
  createDB,
} from "./utils/orbitdb-test-setup";

describe("Special Cases", () => {
  let ipfs1: any;
  let orbitdb1: any, orbitdb: any;
  let db1: any, db2: any;

  beforeAll(async () => {
    ({ ipfs1 } = await setupTwoNodes());
    orbitdb1 = await createDB(ipfs1, "user1");
  });

  afterAll(async () => {
    if (db1) await db1.close();
    if (db2) await db2.close();
    if (orbitdb1) await orbitdb1.stop();
    if (orbitdb) await orbitdb.stop();
    await teardownTwoNodes(ipfs1, null, ["./orbitdb"]);
  });

  it("returns the same database instance when opened multiple times", async () => {
    let err: any;
    try {
      db1 = await orbitdb1.open("helloworld1");
      db2 = await orbitdb1.open("helloworld1");
    } catch (e) {
      err = e;
    }
    strictEqual(err, undefined);
    strictEqual(db1.name, "helloworld1");
    strictEqual(db2.name, "helloworld1");
    strictEqual(db1.address, db2.address);
  });

  it("returns the database instance after stopping OrbitDB", async () => {
    let err: any;
    try {
      orbitdb = await createDB(ipfs1, "user1");
      db1 = await orbitdb.open("helloworld1");
      await orbitdb.stop();
      orbitdb = await createDB(ipfs1, "user1");
      db1 = await orbitdb.open("helloworld1");
    } catch (e) {
      err = e;
    }
    strictEqual(err, undefined);
    strictEqual(db1.name, "helloworld1");
  });
});

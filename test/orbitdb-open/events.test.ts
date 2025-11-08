import { strictEqual, deepStrictEqual } from "assert";
import {
  setupTwoNodes,
  teardownTwoNodes,
  createDB,
} from "./utils/orbitdb-test-setup";
import waitFor from "../utils/wait-for.js";
import { describe, it, beforeAll, afterAll } from "vitest";

describe("Events Database", () => {
  let ipfs1: any, ipfs2: any;
  let orbitdb1: any, orbitdb2: any;
  let db: any, db2: any;
  const amount = 10;

  beforeAll(async () => {
    ({ ipfs1, ipfs2 } = await setupTwoNodes());
    orbitdb1 = await createDB(ipfs1, "user1");

    db = await orbitdb1.open("helloworld");
    for (let i = 0; i < amount; i++) {
      await db.add("hello" + i);
    }
    await db.close();

    orbitdb2 = await createDB(ipfs2, "user2");
  });

  afterAll(async () => {
    if (db) await db.close();
    if (db2) await db2.close();
    if (orbitdb1) await orbitdb1.stop();
    if (orbitdb2) await orbitdb2.stop();
    await teardownTwoNodes(ipfs1, ipfs2, ["./orbitdb"]);
  });

  it("returns all entries", async () => {
    db = await orbitdb1.open("helloworld");
    const expected = Array.from({ length: amount }, (_, i) => "hello" + i);

    const all: any[] = [];
    for await (const event of db.iterator()) all.unshift(event);

    deepStrictEqual(
      all.map((e) => e.value),
      expected
    );
  });

  it("replicates the database", async () => {
    db2 = await orbitdb2.open(db.address);

    let connected = false;
    let updateCount = 0;

    db2.events.on("join", () => (connected = true));
    db2.events.on("update", () => ++updateCount);

    await waitFor(
      () => connected,
      () => true
    );
    await waitFor(
      () => updateCount > 0,
      () => true
    );

    const expected = Array.from({ length: amount }, (_, i) => "hello" + i);

    const all: any[] = [];
    for await (const event of db2.iterator()) all.unshift(event);

    deepStrictEqual(
      all.map((e) => e.value),
      expected
    );
  });
});

import { strictEqual, deepStrictEqual } from "assert";
import {
  setupTwoNodes,
  teardownTwoNodes,
  createDB,
} from "./utils/orbitdb-test-setup";
import { describe, it, beforeAll, afterAll } from "vitest";

describe("Documents Database", () => {
  let ipfs1: any;
  let orbitdb1: any;
  let db: any;
  const amount = 10;

  beforeAll(async () => {
    ({ ipfs1 } = await setupTwoNodes());
    orbitdb1 = await createDB(ipfs1, "user1");
    db = await orbitdb1.open("helloworld", { type: "documents" });

    for (let i = 0; i < amount; i++) {
      await db.put({ _id: "hello" + i, msg: "hello" + i });
    }

    await db.close();
  });

  afterAll(async () => {
    if (db) await db.close();
    if (orbitdb1) await orbitdb1.stop();
    await teardownTwoNodes(ipfs1, null, ["./orbitdb"]);
  });

  it("returns all documents", async () => {
    db = await orbitdb1.open(db.address);

    const expected = Array.from({ length: amount }, (_, i) => ({
      _id: "hello" + i,
      msg: "hello" + i,
    }));

    const all: any[] = [];
    for await (const doc of db.iterator()) all.unshift(doc);

    deepStrictEqual(
      all.map((e) => e.value),
      expected
    );
  });
});

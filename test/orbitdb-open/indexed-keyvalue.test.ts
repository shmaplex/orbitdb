import { strictEqual, deepStrictEqual } from "assert";
import { describe, it, beforeAll, afterAll } from "vitest";
import {
  setupTwoNodes,
  teardownTwoNodes,
  createDB,
} from "./utils/orbitdb-test-setup";
import KeyValueIndexed from "../../src/databases/keyvalue-indexed";

describe("Indexed KeyValue Database", () => {
  let ipfs1: any;
  let orbitdb1: any;
  let db: any;
  const amount = 10;

  beforeAll(async () => {
    ({ ipfs1 } = await setupTwoNodes());
    orbitdb1 = await createDB(ipfs1, "user1");
    db = await orbitdb1.open("helloworld", { Database: KeyValueIndexed() });

    for (let i = 0; i < amount; i++) {
      await db.put("key" + i, "hello" + i);
    }

    await db.close();
  });

  afterAll(async () => {
    if (db) await db.close();
    if (orbitdb1) await orbitdb1.stop();
    await teardownTwoNodes(ipfs1, null, ["./orbitdb", "./index"]);
  });

  it("returns all entries including index", async () => {
    db = await orbitdb1.open(db.address, { Database: KeyValueIndexed() });

    const expected = Array.from({ length: amount }, (_, i) => ({
      key: "key" + i,
      value: "hello" + i,
    }));

    const result: { key: string; value: string }[] = [];
    for await (const { key, value } of db.iterator()) {
      result.unshift({ key, value });
    }

    deepStrictEqual(result, expected);
  });
});

import { deepStrictEqual } from "assert";
import { describe, it, beforeAll, afterAll } from "vitest";
import {
  setupTwoNodes,
  teardownTwoNodes,
  createDB,
} from "./utils/orbitdb-test-setup";
import { rimraf } from "rimraf";

describe("Database Meta Info", () => {
  let ipfs1: any;
  let ipfs2: any;
  let orbitdb1: any;
  let db: any;
  const expected = { hello: "world" };

  beforeAll(async () => {
    ({ ipfs1, ipfs2 } = await setupTwoNodes());
    orbitdb1 = await createDB(ipfs1, "user1", "./orbitdb1");
    db = await orbitdb1.open("helloworld", { meta: expected });
  });

  afterAll(async () => {
    if (db) await db.drop().then(() => db.close());
    if (orbitdb1) await orbitdb1.stop();
    await teardownTwoNodes(ipfs1, ipfs2, ["./orbitdb1"]);
  });

  it("contains the given meta info", () => {
    deepStrictEqual(db.meta, expected);
  });
});

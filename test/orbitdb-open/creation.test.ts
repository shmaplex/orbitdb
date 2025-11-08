import { strictEqual, notStrictEqual } from "assert";
import fs from "fs";
import path from "path";
import { isValidAddress } from "../../src/index.js";
import {
  setupTwoNodes,
  teardownTwoNodes,
  createDB,
} from "./utils/orbitdb-test-setup.js";
import { describe, it, beforeAll, afterAll } from "vitest";

describe("Database Creation", () => {
  let ipfs1: any, ipfs2: any;
  let orbitdb1: any;
  let db: any;

  beforeAll(async () => {
    ({ ipfs1, ipfs2 } = await setupTwoNodes());
    orbitdb1 = await createDB(ipfs1, "user1", "./orbitdb1");
    db = await orbitdb1.open("helloworld");
  });

  afterAll(async () => {
    if (db) await db.drop().then(() => db.close());
    if (orbitdb1) await orbitdb1.stop();
    await teardownTwoNodes(ipfs1, ipfs2, [
      "./orbitdb1",
      "./orbitdb2",
      "./ipfs1",
      "./ipfs2",
    ]);
  });

  it("creates a database instance", () => {
    notStrictEqual(db, undefined);
  });

  it("has an address", () => {
    notStrictEqual(db.address, undefined);
  });

  it("has a valid OrbitDB address", () => {
    strictEqual(isValidAddress(db.address), true);
  });

  it("has a name", () => {
    strictEqual(db.name, "helloworld");
  });

  it("has an identity", () => {
    notStrictEqual(db.identity, undefined);
  });

  it("has a close function", () => {
    notStrictEqual(db.close, undefined);
    strictEqual(typeof db.close, "function");
  });

  it("has a drop function", () => {
    notStrictEqual(db.drop, undefined);
    strictEqual(typeof db.drop, "function");
  });

  it("has an addOperation function", () => {
    notStrictEqual(db.addOperation, undefined);
    strictEqual(typeof db.addOperation, "function");
  });

  it("has a log", () => {
    notStrictEqual(db.log, undefined);
  });

  it("log id matches database address", () => {
    strictEqual(db.log.id, db.address.toString());
  });

  it("has an events emitter", () => {
    notStrictEqual(db.events, undefined);
  });

  it("has a type", () => {
    notStrictEqual(db.type, undefined);
  });

  it('type equals "events"', () => {
    strictEqual(db.type, "events");
  });

  it("has an add function", () => {
    notStrictEqual(db.add, undefined);
    strictEqual(typeof db.add, "function");
  });

  it("has a get function", () => {
    notStrictEqual(db.get, undefined);
    strictEqual(typeof db.get, "function");
  });

  it("has an iterator function", () => {
    notStrictEqual(db.iterator, undefined);
    strictEqual(typeof db.iterator, "function");
  });

  it("has an all function", () => {
    notStrictEqual(db.all, undefined);
    strictEqual(typeof db.all, "function");
  });

  it("has a meta object", () => {
    notStrictEqual(db.meta, undefined);
    strictEqual(typeof db.meta, "object");
  });

  it("creates a directory for the database oplog", () => {
    const expectedPath = path.join(
      orbitdb1.directory,
      `./${db.address}`,
      "/log/_heads"
    );
    const directoryExists = fs.existsSync(expectedPath);
    strictEqual(directoryExists, true);
  });
});

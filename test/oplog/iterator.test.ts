import all from "it-all";
import { rimraf } from "rimraf";
import { copy } from "fs-extra";
import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { Log, Identities, KeyStore } from "../../src/index.js";
import LogCreator from "./utils/log-creator.js";
import testKeysPath from "../fixtures/test-keys-path.js";

const { createLogWithSixteenEntries } = LogCreator;
const keysPath = "./testkeys";

describe("Log - Iterator", () => {
  let keystore: any;
  let identities1: any, identities2: any, identities3: any;
  let testIdentity: any, testIdentity2: any, testIdentity3: any;

  beforeAll(async () => {
    await copy(testKeysPath, keysPath);
    keystore = await KeyStore({ path: keysPath });
    identities1 = await Identities({ keystore });
    identities2 = await Identities({ keystore });
    identities3 = await Identities({ keystore });
    testIdentity = await identities1.createIdentity({ id: "userC" });
    testIdentity2 = await identities2.createIdentity({ id: "userB" });
    testIdentity3 = await identities3.createIdentity({ id: "userC" });
  });

  afterAll(async () => {
    if (keystore) await keystore.close();
    await rimraf(keysPath);
  });

  describe("Basic iterator functionality", () => {
    let log1: any;
    let startHash: string;
    const hashes: [string, number][] = [];
    const logSize = 100;
    const startIndex = 67;

    beforeEach(async () => {
      log1 = await Log(testIdentity, { logId: "X" });

      for (let i = 0; i < logSize; i++) {
        const entry = await log1.append("entry" + i);
        hashes.push([entry.hash, hashes.length]);
      }

      startHash = hashes[startIndex][0];
      expect(startHash).toBe(hashes[startIndex][0]);
    });

    it("returns length with lte and amount", async () => {
      const amount = 10;
      const it = log1.iterator({ lte: startHash, amount });
      const result = await all(it);
      expect(result.length).toBe(10);
      expect(result[0].hash).toBe(startHash);
    });

    it("returns entries with lte and amount", async () => {
      const amount = 10;
      const it = log1.iterator({ lte: startHash, amount });
      let i = 0;
      for await (const entry of it) {
        expect(entry.payload).toBe("entry" + (67 - i++));
      }
      expect(i).toBe(amount);
    });

    it("returns length with lt and amount", async () => {
      const amount = 10;
      const it = log1.iterator({ lt: startHash, amount });
      const result = await all(it);
      expect(result.length).toBe(amount);
    });

    it("returns entries with lt and amount", async () => {
      const amount = 10;
      const it = log1.iterator({ lt: startHash, amount });
      let i = 0;
      for await (const entry of it) {
        expect(entry.payload).toBe("entry" + (66 - i++));
      }
      expect(i).toBe(amount);
    });

    it("returns correct length with gt and amount", async () => {
      const amount = 5;
      const it = log1.iterator({ gt: startHash, amount });
      let i = 0;
      for await (const entry of it) {
        expect(entry.payload).toBe("entry" + (72 - i++));
      }
      expect(i).toBe(amount);
    });

    it("returns length with gte and amount", async () => {
      const amount = 12;
      const it = log1.iterator({ gte: startHash, amount });
      const result = await all(it);
      expect(result.length).toBe(amount);
      expect(result[result.length - 1].hash).toBe(startHash);
    });

    it("returns entries with gte and amount", async () => {
      const amount = 12;
      const it = log1.iterator({ gte: startHash, amount });
      let i = 0;
      for await (const entry of it) {
        expect(entry.payload).toBe("entry" + (78 - i++));
      }
      expect(i).toBe(amount);
    });

    it("iterates with lt and gt", async () => {
      const expectedHashes = hashes.slice(0, 12).map((e) => e[0]);
      const it = log1.iterator({
        gt: expectedHashes[0],
        lt: expectedHashes[expectedHashes.length - 1],
      });
      const result = await all(it);
      const hashes_ = result.reverse().map((e) => e.hash);
      expect(hashes_.length).toBe(10);
      for (let i = 0; i < hashes_.length; i++) {
        expect(hashes_[i]).toBe(expectedHashes[i + 1]);
      }
    });

    it("iterates with lt and gte", async () => {
      const expectedHashes = hashes.slice(0, 26).map((e) => e[0]);
      const it = log1.iterator({
        gte: expectedHashes[0],
        lt: expectedHashes[expectedHashes.length - 1],
      });
      const result = await all(it);
      const hashes_ = result.map((e) => e.hash);
      expect(hashes_.length).toBe(25);
      expect(hashes_.indexOf(expectedHashes[0])).toBe(24);
      expect(hashes_.indexOf(expectedHashes[expectedHashes.length - 1])).toBe(
        -1
      );
      expect(hashes_.indexOf(expectedHashes[expectedHashes.length - 2])).toBe(
        0
      );
      for (let i = 0; i < hashes_.length; i++) {
        expect(hashes_[i]).toBe(expectedHashes[expectedHashes.length - 2 - i]);
      }
    });

    it("iterates with lte and gt", async () => {
      const expectedHashes = hashes.slice(0, 5).map((e) => e[0]);
      const it = log1.iterator({
        gt: expectedHashes[0],
        lte: expectedHashes[expectedHashes.length - 1],
      });
      const result = await all(it);
      const hashes_ = result.map((e) => e.hash);
      expect(hashes_.length).toBe(4);
      expect(hashes_.indexOf(expectedHashes[0])).toBe(-1);
      expect(hashes_.indexOf(expectedHashes[expectedHashes.length - 1])).toBe(
        0
      );
      expect(hashes_.indexOf(expectedHashes[expectedHashes.length - 2])).toBe(
        1
      );
      expect(hashes_.indexOf(expectedHashes[expectedHashes.length - 3])).toBe(
        2
      );
      expect(hashes_.indexOf(expectedHashes[expectedHashes.length - 4])).toBe(
        3
      );
    });

    it("iterates with lte and gte", async () => {
      const expectedHashes = hashes.slice(0, 10).map((e) => e[0]);
      const it = log1.iterator({
        gte: expectedHashes[0],
        lte: expectedHashes[expectedHashes.length - 1],
      });
      const result = await all(it);
      const hashes_ = result.map((e) => e.hash);
      expect(hashes_.length).toBe(10);
      expect(hashes_.indexOf(expectedHashes[0])).toBe(9);
      expect(hashes_.indexOf(expectedHashes[expectedHashes.length - 1])).toBe(
        0
      );
      for (let i = 0; i < hashes_.length; i++) {
        expect(hashes_[i]).toBe(expectedHashes[expectedHashes.length - 1 - i]);
      }
    });

    it("iterates the full log by default", async () => {
      const expectedHashes = hashes.map((e) => e[0]);
      const it = log1.iterator({});
      const result = await all(it);
      const hashes_ = result.map((e) => e.hash);
      expect(hashes_.length).toBe(logSize);
      for (let i = 0; i < hashes_.length; i++) {
        expect(hashes_[i]).toBe(expectedHashes[expectedHashes.length - 1 - i]);
      }
    });

    it("iterates the full log with gte and lte and amount", async () => {
      const expectedHashes = hashes.map((e) => e[0]);
      const it = log1.iterator({
        gte: expectedHashes[0],
        lte: expectedHashes[expectedHashes.length - 1],
        amount: logSize,
      });
      const result = await all(it);
      const hashes_ = result.map((e) => e.hash);
      expect(hashes_.length).toBe(logSize);
      for (let i = 0; i < hashes_.length; i++) {
        expect(hashes_[i]).toBe(expectedHashes[expectedHashes.length - 1 - i]);
      }
    });

    it("returns length with gt and default amount", async () => {
      const it = log1.iterator({ gt: startHash });
      const result = await all(it);
      expect(result.length).toBe(32);
    });

    it("returns entries with gt and default amount", async () => {
      const it = log1.iterator({ gt: startHash });
      let i = 0;
      for await (const entry of it) {
        expect(entry.payload).toBe("entry" + (logSize - 1 - i++));
      }
      expect(i).toBe(32);
    });

    it("returns length with gte and default amount", async () => {
      const it = log1.iterator({ gte: startHash });
      const result = await all(it);
      expect(result.length).toBe(33);
    });

    it("returns entries with gte and default amount", async () => {
      const it = log1.iterator({ gte: startHash });
      let i = 0;
      for await (const entry of it) {
        expect(entry.payload).toBe("entry" + (logSize - 1 - i++));
      }
      expect(i).toBe(33);
    });

    it("returns length with lt and default amount value", async () => {
      const it = log1.iterator({ lt: startHash });
      const result = await all(it);
      expect(result.length).toBe(67);
    });

    it("returns entries with lt and default amount value", async () => {
      const it = log1.iterator({ lt: startHash });
      let i = 0;
      for await (const entry of it) {
        expect(entry.payload).toBe("entry" + (66 - i++));
      }
      expect(i).toBe(67);
    });

    it("returns length with lte and default amount value", async () => {
      const it = log1.iterator({ lte: startHash });
      const result = await all(it);
      expect(result.length).toBe(68);
    });

    it("returns entries with lte and default amount value", async () => {
      const it = log1.iterator({ lte: startHash });
      let i = 0;
      for await (const entry of it) {
        expect(entry.payload).toBe("entry" + (67 - i++));
      }
      expect(i).toBe(68);
    });

    it("returns correct entries with gt when amount is more than total entries", async () => {
      const amount = logSize - startIndex;
      const expectedAmount = logSize - startIndex - 1;
      const it = log1.iterator({ gt: startHash, amount });
      let i = 0;
      for await (const entry of it) {
        expect(entry.payload).toBe("entry" + (logSize - 1 - i++));
      }
      expect(i).toBe(expectedAmount);
    });

    it("returns correct entries with gte when amount is more than total entries", async () => {
      const amount = logSize - startIndex + 1;
      const expectedAmount = amount - 1;
      const it = log1.iterator({ gte: startHash, amount });
      let i = 0;
      for await (const entry of it) {
        expect(entry.payload).toBe("entry" + (logSize - 1 - i++));
      }
      expect(i).toBe(expectedAmount);
    });

    it("returns zero entries when amount is 0", async () => {
      const it = log1.iterator({ amount: 0 });
      let i = 0;
      for await (const entry of it) {
        i++;
      }
      expect(i).toBe(0);
    });
  });

  describe("Iteration over forked/joined logs", () => {
    let fixture: any, identities: any[], heads: any[];

    beforeAll(async () => {
      identities = [testIdentity3, testIdentity2, testIdentity3, testIdentity];
      fixture = await createLogWithSixteenEntries(Log, null, identities);
      heads = await fixture.log.heads();
    });

    it("returns the full length from all heads", async () => {
      const it = fixture.log.iterator({ lte: heads });
      const result = await all(it);
      expect(result.length).toBe(16);
    });

    it("returns partial entries from all heads", async () => {
      const it = fixture.log.iterator({ lte: heads, amount: 6 });
      const result = await all(it);
      expect(result.map((e) => e.payload)).toEqual([
        "entryA10",
        "entryA9",
        "entryA8",
        "entryA7",
        "entryC0",
        "entryA6",
      ]);
    });

    it("returns partial logs from single heads #1", async () => {
      const it = fixture.log.iterator({ lte: [heads[0]] });
      const result = await all(it);
      expect(result.length).toBe(10);
    });

    it("returns partial logs from single heads #2", async () => {
      const it = fixture.log.iterator({ lte: [heads[1]] });
      const result = await all(it);
      expect(result.length).toBe(11);
    });

    it("throws error if lte not a string or array of entries", async () => {
      let errMsg;
      try {
        await all(fixture.log.iterator({ lte: false as any }));
      } catch (e: any) {
        errMsg = e.message;
      }
      expect(errMsg).toBe("lte must be a string or an array of Entries");
    });

    it("throws error if lt not a string or array of entries", async () => {
      let errMsg;
      try {
        await all(fixture.log.iterator({ lt: {} as any }));
      } catch (e: any) {
        errMsg = e.message;
      }
      expect(errMsg).toBe("lt must be a string or an array of Entries");
    });
  });
});

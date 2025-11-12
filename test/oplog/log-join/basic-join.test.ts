import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { Log } from "../../../src";
import { setupIdentities, cleanup, last } from "../utils/test-setup";

let keystore: any;
let log1: any, log2: any;
let testIdentities: any[];

describe("Log - Join (basic)", () => {
  beforeAll(async () => {
    const setup = await setupIdentities();
    keystore = setup.keystore;
    testIdentities = setup.testIdentities;
  });

  afterAll(async () => {
    await cleanup(keystore);
  });

  beforeEach(async () => {
    log1 = await Log(testIdentities[0], { logId: "X" });
    log2 = await Log(testIdentities[1], { logId: "X" });
  });

  it("joins logs", async () => {
    const items1: any[] = [];
    const items2: any[] = [];
    const amount = 20;

    for (let i = 1; i <= amount; i++) {
      items1.push(await log1.append("entryA" + i));
      items2.push(await log2.append("entryB" + i));
    }

    expect(items1.length).toBe(amount);
    expect(items2.length).toBe(amount);

    const valuesA = await log1.values();
    const valuesB = await log2.values();

    expect(valuesA.length).toBe(amount);
    expect(valuesB.length).toBe(amount);

    await log1.join(log2);
    const valuesC = await log1.values();

    expect(valuesC.length).toBe(amount * 2);
    expect((await log1.heads()).length).toBe(2);
  });

  it("throws error if first log not defined", async () => {
    let err;
    try {
      await log1.join();
    } catch (e: any) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.message).toBe("Log instance not defined");
  });

  it("throws error if argument is not a Log instance", async () => {
    let err;
    try {
      await log1.join({});
    } catch (e: any) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.message).toBe("Given argument is not an instance of Log");
  });
});

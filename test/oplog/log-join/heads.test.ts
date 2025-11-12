import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { Log } from "../../../src";
import { setupIdentities, cleanup } from "../utils/test-setup";

let keystore: any;
let log1: any, log2: any;
let testIdentities: any[];

describe("Log - Heads & Forks", () => {
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

  it("replaces heads correctly", async () => {
    await log1.append("A1");
    await log1.append("A2");
    await log2.append("B1");

    await log1.join(log2);
    const heads = await log1.heads();
    expect(heads.length).toBe(2);
  });

  it("handles forks correctly", async () => {
    const e1 = await log1.append("fork1");
    const e2 = await log2.append("fork2");

    await log1.join(log2);
    const values = await log1.values();
    expect(values.length).toBe(2);
    expect(values.map((e: any) => e.payload)).toContain("fork1");
    expect(values.map((e: any) => e.payload)).toContain("fork2");
  });

  it("joinEntry integrates new entry correctly", async () => {
    const entry = await log2.append("newEntry");
    await log1.join(log2);
    const values = await log1.values();
    expect(values.map((v: any) => v.payload)).toContain("newEntry");
  });
});

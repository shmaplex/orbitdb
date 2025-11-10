import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { Log } from "../../../src/index.js";
import { setupIdentities, cleanup } from "../utils/test-setup";

let keystore: any;
let log1: any, log2: any;
let testIdentities: any[];

describe("Log - Access Control", () => {
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

  it("prevents unauthorized append", async () => {
    let error;
    try {
      await log2.append("unauthorized");
    } catch (e: any) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toMatch(/not allowed to append/);
  });

  it("allows authorized append", async () => {
    await log1.append("authorized");
    const values = await log1.values();
    expect(values.map((v: any) => v.payload)).toContain("authorized");
  });
});

import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { Log } from "../../../src/index.js";
import { setupIdentities, cleanup } from "../utils/test-setup";

let keystore: any;
let log1: any;
let testIdentities: any[];

describe("Log - Entry Verification", () => {
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
  });

  it("detects missing payload", async () => {
    let error;
    try {
      await log1.append(undefined);
    } catch (e: any) {
      error = e;
    }
    expect(error).toBeDefined();
  });

  it("detects missing signature or key", async () => {
    const invalidEntry = { payload: "data", signature: null, key: null };
    let error;
    try {
      await log1.join({ values: () => [invalidEntry] });
    } catch (e: any) {
      error = e;
    }
    expect(error).toBeDefined();
  });

  it("rejects invalid entries", async () => {
    const invalidEntry = { payload: "tampered", hash: "bad" };
    let error;
    try {
      await log1.join({ values: () => [invalidEntry] });
    } catch (e: any) {
      error = e;
    }
    expect(error).toBeDefined();
  });
});

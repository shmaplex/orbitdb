// test/oplog/log-join/unique-items.test.ts
import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { Log } from "../../../src";
import { setupIdentities, cleanup, last } from "../utils/test-setup";
import { EntryType } from "../../../src/oplog";
import { LogType } from "../../../src/oplog";

let keystore: any;
let log1: LogType, log2: LogType;
let testIdentities: Awaited<
  ReturnType<typeof setupIdentities>
>["testIdentities"];

describe("Log - Join (unique items)", () => {
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

  it("joins only unique items", async () => {
    await log1.append("helloA1");
    await log1.append("helloA2");
    await log2.append("helloB1");
    await log2.append("helloB2");

    await log1.join(log2);
    await log1.join(log2);

    const expectedData = ["helloA1", "helloB1", "helloA2", "helloB2"];
    const values: EntryType[] = await log1.values();

    expect(values.length).toBe(4);
    expect(values.map((e) => e.payload)).toEqual(expectedData);
    expect((last(values).next ?? []).length).toBe(1);
  });
});

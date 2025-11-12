import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { Log } from "../../../src";
import { setupIdentities, cleanup } from "../utils/test-setup";

let keystore: any;
let logs: any[] = [];
let testIdentities: any[];

describe("Log - Multi Logs Join & Commutativity", () => {
  beforeAll(async () => {
    const setup = await setupIdentities();
    keystore = setup.keystore;
    testIdentities = setup.testIdentities;
  });

  afterAll(async () => {
    await cleanup(keystore);
  });

  beforeEach(async () => {
    logs = [
      await Log(testIdentities[0], { logId: "X" }),
      await Log(testIdentities[1], { logId: "X" }),
      await Log(testIdentities[2], { logId: "X" }),
      await Log(testIdentities[3], { logId: "X" }),
    ];
  });

  it("joins multiple logs correctly", async () => {
    const amount = 5;

    for (let i = 1; i <= amount; i++) {
      await logs[0].append("A" + i);
      await logs[1].append("B" + i);
      await logs[2].append("C" + i);
      await logs[3].append("D" + i);
    }

    // join logs pairwise
    await logs[0].join(logs[1]);
    await logs[0].join(logs[2]);
    await logs[0].join(logs[3]);

    const values = await logs[0].values();
    expect(values.length).toBe(amount * 4);
  });

  it("joining logs is commutative", async () => {
    const l1 = logs[0];
    const l2 = logs[1];

    await l1.append("hello");
    await l2.append("world");

    await l1.join(l2);
    const values1 = (await l1.values()).map((e: any) => e.payload);

    await l2.join(l1);
    const values2 = (await l2.values()).map((e: any) => e.payload);

    expect(values1.sort()).toEqual(values2.sort());
  });
});

/**
 * Represents a utility class for creating log instances with pre-populated entries.
 */
export default class LogCreator {
  /**
   * Creates a log with 16 entries across multiple logs and joins.
   * Useful for testing small-scale log merging and entry ordering.
   *
   * @template T - The type of the log instance returned by the Log factory.
   * @param Log - A factory function/class to create a log instance.
   * @param ipfs - The IPFS instance (not used directly here, but kept for compatibility).
   * @param identities - Array of identity objects to assign to logs.
   * @returns An object containing:
   *  - `log`: The final log instance.
   *  - `expectedData`: Array of expected entry payloads in order.
   *  - `json`: Array of actual payloads from the log.
   */
  static async createLogWithSixteenEntries<
    T extends {
      append(payload: string): Promise<void>;
      join(other: T): Promise<void>;
      values(): Promise<{ payload: string }[]>;
    }
  >(
    Log: new (identity: any, options: { logId: string }) => Promise<T>,
    ipfs: any,
    identities: any[]
  ): Promise<{ log: T; expectedData: string[]; json: string[] }> {
    const create = async () => {
      const logA = await Log(identities[0], { logId: "X" });
      const logB = await Log(identities[1], { logId: "X" });
      const log3 = await Log(identities[2], { logId: "X" });
      const log = await Log(identities[3], { logId: "X" });

      for (let i = 1; i <= 5; i++) {
        await logA.append("entryA" + i);
      }
      for (let i = 1; i <= 5; i++) {
        await logB.append("entryB" + i);
      }
      await log3.join(logA);
      await log3.join(logB);
      for (let i = 6; i <= 10; i++) {
        await logA.append("entryA" + i);
      }
      await log.join(log3);
      await log.append("entryC0");
      await log.join(logA);
      return log;
    };

    const expectedData = [
      "entryA1",
      "entryB1",
      "entryA2",
      "entryB2",
      "entryA3",
      "entryB3",
      "entryA4",
      "entryB4",
      "entryA5",
      "entryB5",
      "entryA6",
      "entryC0",
      "entryA7",
      "entryA8",
      "entryA9",
      "entryA10",
    ];

    const log = await create();
    const json = (await log.values()).map((e) => e.payload);
    return { log, expectedData, json };
  }

  /**
   * Creates a log with 200 entries alternating between two logs, joining after each append.
   * Useful for performance or stress testing.
   *
   * @template T - The type of the log instance returned by the Log factory.
   * @param Log - A factory function/class to create a log instance.
   * @param ipfs - The IPFS instance (not used directly here, but kept for compatibility).
   * @param identities - Array of identity objects to assign to logs.
   * @returns An object containing:
   *  - `log`: The final log instance.
   *  - `expectedData`: Array of expected entry payloads in order.
   */
  static async createLogWithTwoHundredEntries<
    T extends {
      append(payload: string): Promise<void>;
      join(other: T): Promise<void>;
    }
  >(
    Log: new (identity: any, options: { logId: string }) => Promise<T>,
    ipfs: any,
    identities: any[]
  ): Promise<{ log: T; expectedData: string[] }> {
    const amount = 100;
    const expectedData: string[] = [];

    const create = async () => {
      const logA = await Log(identities[0], { logId: "X" });
      const logB = await Log(identities[1], { logId: "X" });

      for (let i = 1; i <= amount; i++) {
        await logA.append("entryA" + i);
        await logB.join(logA);
        await logB.append("entryB" + i);
        await logA.join(logB);
        expectedData.push("entryA" + i);
        expectedData.push("entryB" + i);
      }

      return logA;
    };

    const log = await create();
    return { log, expectedData };
  }
}

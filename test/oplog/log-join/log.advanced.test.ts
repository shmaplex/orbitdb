import { describe, it, expect, beforeEach } from "vitest";
import MemoryStorage from "../../../src/storage/memory";
import KeyStore from "../../../src/key-store";
import { Identities } from "../../../src/identities";
import { Log } from "../../../src/oplog";
import { EntryType } from "../../../src/oplog";

let keystore: Awaited<ReturnType<typeof KeyStore>>;
let identities: Awaited<ReturnType<typeof Identities>>;

beforeEach(async () => {
  keystore = await KeyStore();
  identities = await Identities({ keystore });
});

describe("Advanced Log Joins", () => {
  it("joins logs twice", async () => {
    const storage1 = await MemoryStorage();
    const storage2 = await MemoryStorage();

    const log1 = await Log(identities, {
      entryStorage: storage1,
      headsStorage: storage1,
      indexStorage: storage1,
    });
    const log2 = await Log(identities, {
      entryStorage: storage2,
      headsStorage: storage2,
      indexStorage: storage2,
    });

    await log1.append("entry1");
    await log2.append("entry2");

    await log1.join(log2);
    await log2.join(log1);

    const log1Payloads = (await log1.values()).map((e: EntryType) => e.payload);
    const log2Payloads = (await log2.values()).map((e: EntryType) => e.payload);

    expect(log1Payloads).toContain("entry2");
    expect(log2Payloads).toContain("entry1");
  });

  it("joins 2 logs two ways and has correct heads at every step", async () => {
    const storageA = await MemoryStorage();
    const storageB = await MemoryStorage();

    const logA = await Log(identities, {
      entryStorage: storageA,
      headsStorage: storageA,
      indexStorage: storageA,
    });
    const logB = await Log(identities, {
      entryStorage: storageB,
      headsStorage: storageB,
      indexStorage: storageB,
    });

    await logA.append("a1");
    await logB.append("b1");
    await logA.append("a2");

    await logB.join(logA);
    const logBHeads = (await logB.heads()).map((h: EntryType) => h.payload);
    expect(logBHeads).toContain("a2");
    expect(logBHeads).toContain("b1");

    await logA.join(logB);
    const logAHeads = (await logA.heads()).map((h: EntryType) => h.payload);
    expect(logAHeads).toContain("a2");
    expect(logAHeads).toContain("b1");
  });

  it("joins 4 logs to one", async () => {
    const logs = await Promise.all(
      Array.from({ length: 4 }, async () => {
        const storage = await MemoryStorage();
        return Log(identities, {
          entryStorage: storage,
          headsStorage: storage,
          indexStorage: storage,
        });
      })
    );

    await Promise.all(logs.map((l, i) => l.append(`entry${i + 1}`)));

    for (let i = 1; i < logs.length; i++) {
      await logs[0].join(logs[i]);
    }

    const log0Payloads = (await logs[0].values()).map(
      (e: EntryType) => e.payload
    );
    expect(log0Payloads).toEqual(
      expect.arrayContaining(["entry1", "entry2", "entry3", "entry4"])
    );
  });

  it("joins logs and updates clocks", async () => {
    const storage1 = await MemoryStorage();
    const storage2 = await MemoryStorage();

    const log1 = await Log(identities, {
      entryStorage: storage1,
      headsStorage: storage1,
      indexStorage: storage1,
    });
    const log2 = await Log(identities, {
      entryStorage: storage2,
      headsStorage: storage2,
      indexStorage: storage2,
    });

    await log1.append("x1");
    await log2.append("y1");
    await log2.append("y2");

    const preClock = await log1.clock();
    await log1.join(log2);

    const postClock = await log1.clock();

    // Clock is object { id: string, time: number }
    expect(postClock.time).toBeGreaterThan(preClock.time);
  });

  it("doesn't add an entry if already in the log", async () => {
    const storage = await MemoryStorage();
    const log = await Log(identities, {
      entryStorage: storage,
      headsStorage: storage,
      indexStorage: storage,
    });
    await log.append("dup");

    await log.join(log);
    const dupEntries = (await log.values()).filter(
      (entry: EntryType) => entry.payload === "dup"
    );
    expect(dupEntries).toHaveLength(1);
  });

  it("replaces heads if new entry is a new head", async () => {
    const storage = await MemoryStorage();
    const log = await Log(identities, {
      entryStorage: storage,
      headsStorage: storage,
      indexStorage: storage,
    });
    await log.append("first");
    await log.append("second");

    const heads = (await log.heads()).map((h: EntryType) => h.payload);
    expect(heads).toContain("second");
    expect(heads).not.toContain("first");
  });

  it("handles forked logs correctly", async () => {
    const storageA = await MemoryStorage();
    const storageB = await MemoryStorage();

    const logA = await Log(identities, {
      entryStorage: storageA,
      headsStorage: storageA,
      indexStorage: storageA,
    });
    const logB = await Log(identities, {
      entryStorage: storageB,
      headsStorage: storageB,
      indexStorage: storageB,
    });

    await logA.append("a1");
    await logA.append("a2");
    await logB.append("b1");
    await logB.append("b2");

    await logA.join(logB);
    const heads = (await logA.heads()).map((h: EntryType) => h.payload);
    expect(heads).toEqual(expect.arrayContaining(["a2", "b2"]));
  });
});

describe("Entry Verification and Signatures", () => {
  it("throws if entry payload is missing", async () => {
    const storage = await MemoryStorage();
    const log = await Log(identities, {
      entryStorage: storage,
      headsStorage: storage,
      indexStorage: storage,
    });
    const invalidEntry: Partial<EntryType> = {
      key: "fake",
      sig: "fake",
      hash: "fake",
      payload: null,
    };

    await expect(log.joinEntry(invalidEntry as EntryType)).rejects.toThrow();
  });

  it("throws if entry key is missing", async () => {
    const storage = await MemoryStorage();
    const log = await Log(identities, {
      entryStorage: storage,
      headsStorage: storage,
      indexStorage: storage,
    });
    const e = await log.append("test");
    const broken = { ...e, key: undefined };

    await expect(log.joinEntry(broken as EntryType)).rejects.toThrow();
  });

  it("throws if entry signature is missing", async () => {
    const storage = await MemoryStorage();
    const log = await Log(identities, {
      entryStorage: storage,
      headsStorage: storage,
      indexStorage: storage,
    });
    const e = await log.append("test");
    const broken = { ...e, sig: undefined };

    await expect(log.joinEntry(broken as EntryType)).rejects.toThrow();
  });

  it("throws if entry signature is invalid", async () => {
    const storage = await MemoryStorage();
    const log = await Log(identities, {
      entryStorage: storage,
      headsStorage: storage,
      indexStorage: storage,
    });
    const e = await log.append("test");
    const broken = { ...e, sig: "invalidsig" };

    await expect(log.joinEntry(broken as EntryType)).rejects.toThrow();
  });
});

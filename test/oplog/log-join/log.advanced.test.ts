import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStorage } from "../../src/storage/index.js";
import { Clock } from "../../src/oplog/log.js";
import { Log, Identities, KeyStore } from "../../src/index.js";
import testKeysPath from "../fixtures/test-keys-path.js";
import { privateKeyFromRaw } from "@libp2p/crypto/keys";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";

let keystore: KeyStore;
let identities: Identities;

beforeEach(async () => {
  keystore = new KeyStore(new MemoryStorage());
  identities = new Identities({ keystore });
});

describe("Advanced Log Joins", () => {
  it("joins logs twice", async () => {
    const log1 = new Log(identities, "A", { storage: new MemoryStorage() });
    const log2 = new Log(identities, "B", { storage: new MemoryStorage() });

    const e1 = await log1.append("entry1");
    const e2 = await log2.append("entry2");

    await log1.join(log2);
    await log2.join(log1);

    expect(log1.values.map((e) => e.payload)).toContain("entry2");
    expect(log2.values.map((e) => e.payload)).toContain("entry1");
  });

  it("joins 2 logs two ways and has correct heads at every step", async () => {
    const logA = new Log(identities, "A", { storage: new MemoryStorage() });
    const logB = new Log(identities, "B", { storage: new MemoryStorage() });

    const a1 = await logA.append("a1");
    const b1 = await logB.append("b1");
    const a2 = await logA.append("a2");

    await logB.join(logA);
    expect(logB.heads.map((h) => h.payload)).toContain("a2");
    expect(logB.heads.map((h) => h.payload)).toContain("b1");

    await logA.join(logB);
    expect(logA.heads.map((h) => h.payload)).toContain("a2");
    expect(logA.heads.map((h) => h.payload)).toContain("b1");
  });

  it("joins 4 logs to one", async () => {
    const logs = Array.from(
      { length: 4 },
      (_, i) => new Log(identities, `L${i}`, { storage: new MemoryStorage() })
    );
    await Promise.all(logs.map((l, i) => l.append(`entry${i + 1}`)));

    for (let i = 1; i < logs.length; i++) {
      await logs[0].join(logs[i]);
    }

    expect(logs[0].values.map((e) => e.payload)).toEqual(
      expect.arrayContaining(["entry1", "entry2", "entry3", "entry4"])
    );
  });

  it("joins logs and updates clocks", async () => {
    const log1 = new Log(identities, "X", { storage: new MemoryStorage() });
    const log2 = new Log(identities, "Y", { storage: new MemoryStorage() });

    await log1.append("x1");
    await log2.append("y1");
    await log2.append("y2");

    const preClock = { ...log1.clock };
    await log1.join(log2);

    expect(log1.clock["Y"]).toBe(2);
    expect(log1.clock["X"]).toBe(preClock["X"] + 1 || 1);
  });

  it("doesn't add an entry if already in the log", async () => {
    const log = new Log(identities, "Z", { storage: new MemoryStorage() });
    const e = await log.append("dup");

    await log.join(log);
    expect(log.values.filter((entry) => entry.payload === "dup")).toHaveLength(
      1
    );
  });

  it("replaces heads if new entry is a new head", async () => {
    const log = new Log(identities, "H", { storage: new MemoryStorage() });
    const e1 = await log.append("first");
    const e2 = await log.append("second");

    expect(log.heads.map((h) => h.payload)).toContain("second");
    expect(log.heads.map((h) => h.payload)).not.toContain("first");
  });

  it("handles forked logs correctly", async () => {
    const logA = new Log(identities, "A", { storage: new MemoryStorage() });
    const logB = new Log(identities, "B", { storage: new MemoryStorage() });

    const a1 = await logA.append("a1");
    const a2 = await logA.append("a2");
    const b1 = await logB.append("b1");
    const b2 = await logB.append("b2");

    await logA.join(logB);
    expect(logA.heads.map((h) => h.payload)).toEqual(
      expect.arrayContaining(["a2", "b2"])
    );
  });
});

describe("Entry Verification and Signatures", () => {
  it("throws if entry payload is missing", async () => {
    const log = new Log(identities, "V", { storage: new MemoryStorage() });
    const invalidEntry = {
      key: "fake",
      signature: "fake",
      hash: "fake",
      payload: null,
    };

    await expect(log._verifyEntry(invalidEntry)).rejects.toThrow();
  });

  it("throws if entry key is missing", async () => {
    const log = new Log(identities, "V", { storage: new MemoryStorage() });
    const e = await log.append("test");
    const broken = { ...e, key: undefined };

    await expect(log._verifyEntry(broken)).rejects.toThrow();
  });

  it("throws if entry signature is missing", async () => {
    const log = new Log(identities, "V", { storage: new MemoryStorage() });
    const e = await log.append("test");
    const broken = { ...e, signature: undefined };

    await expect(log._verifyEntry(broken)).rejects.toThrow();
  });

  it("throws if entry signature is invalid", async () => {
    const log = new Log(identities, "V", { storage: new MemoryStorage() });
    const e = await log.append("test");
    const broken = { ...e, signature: "invalidsig" };

    await expect(log._verifyEntry(broken)).rejects.toThrow();
  });
});

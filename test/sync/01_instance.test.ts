// test/sync/01_instance.test.ts
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import {
  setupIdentities,
  cleanup,
  copyKeys,
  createLog,
  keysPath,
} from "./helpers";
import Sync from "../../src/sync.js";
import connectPeers from "../utils/connect-nodes.js";
import waitFor from "../utils/wait-for.js";
import { Entry } from "../../src/index.js";

let ipfs1: any;
let ipfs2: any;
let keystore: any;
let identities: any;
let testIdentity1: any;
let testIdentity2: any;
let peerId1: any;
let peerId2: any;

beforeAll(async () => {
  ({ ipfs1, ipfs2, keystore, identities, testIdentity1, testIdentity2 } =
    await setupIdentities());

  peerId1 = ipfs1.libp2p.peerId;
  peerId2 = ipfs2.libp2p.peerId;

  await connectPeers(ipfs1, ipfs2);
  await copyKeys();
});

afterAll(async () => {
  await cleanup([ipfs1, ipfs2], keystore);
});

describe("Sync instance", () => {
  let sync: any;
  let log: any;

  beforeAll(async () => {
    log = await createLog(testIdentity1);
    sync = await Sync({ ipfs: ipfs1, log });
  });

  afterAll(async () => {
    if (sync) await sync.stop();
    if (log) await log.close();
  });

  it("creates an instance", () => {
    expect(sync).not.toBeUndefined();
  });

  it("has an add function", () => {
    expect(typeof sync.add).toBe("function");
  });

  it("has a start function", () => {
    expect(typeof sync.start).toBe("function");
  });

  it("has a stop function", () => {
    expect(typeof sync.stop).toBe("function");
  });

  it("has events", () => {
    expect(sync.events).not.toBeUndefined();
  });

  it("has a set of peers", () => {
    expect(sync.peers).toBeInstanceOf(Set);
  });
});

describe("Syncing automatically", () => {
  let sync1: any, sync2: any;
  let log1: any, log2: any;
  let joinEventFired = false;
  let syncedEventFired = false;
  let syncedHead: any;
  let expectedEntry: any;

  beforeAll(async () => {
    log1 = await createLog(testIdentity1, "synclog111");
    log2 = await createLog(testIdentity2, "synclog111");

    expectedEntry = await log1.append("hello1");

    const onSynced = async (entry: any) => {
      if (await log2.joinEntry(entry)) {
        syncedHead = entry;
        syncedEventFired = true;
      }
    };

    const onJoin = () => {
      joinEventFired = true;
    };

    sync1 = await Sync({ ipfs: ipfs1, log: log1 });
    sync2 = await Sync({ ipfs: ipfs2, log: log2, onSynced });

    sync1.events.on("join", onJoin);
    sync2.events.on("join", onJoin);

    await waitFor(
      () => joinEventFired && syncedEventFired,
      () => true
    );
  });

  afterAll(async () => {
    if (sync1) await sync1.stop();
    if (sync2) await sync2.stop();
    if (log1) await log1.close();
    if (log2) await log2.close();
  });

  it("syncs the head", () => {
    expect(syncedHead).toEqual(expectedEntry);
  });

  it("updates the set of connected peers", () => {
    expect(sync2.peers.has(String(peerId1))).toBe(true);
    expect(sync1.peers.has(String(peerId2))).toBe(true);
  });
});

describe("Eventual consistency", () => {
  let sync1: any, sync2: any;
  let log1: any, log2: any;
  let joinEventFired = false;
  let syncedHead: any;

  beforeAll(async () => {
    log1 = await createLog(testIdentity1, "synclog7");
    log2 = await createLog(testIdentity2, "synclog7");

    const onSynced = async (entry: any) => {
      if (await log2.joinEntry(entry)) syncedHead = entry;
    };

    const onJoin = () => {
      joinEventFired = true;
    };

    sync1 = await Sync({ ipfs: ipfs1, log: log1 });
    sync2 = await Sync({ ipfs: ipfs2, log: log2, onSynced });

    sync1.events.on("join", onJoin);
    sync2.events.on("join", onJoin);

    await waitFor(
      () => joinEventFired,
      () => true
    );
  });

  afterAll(async () => {
    if (sync1) await sync1.stop();
    if (sync2) await sync2.stop();
    if (log1) await log1.close();
    if (log2) await log2.close();
  });

  it("is eventually consistent", async () => {
    const e2 = await log1.append("hello2");
    const e3 = await log1.append("hello3");
    const e4 = await log1.append("hello4");
    const expected = await log1.append("hello5");

    await sync1.add(e3);
    await sync1.add(e2);
    await sync1.add(e4);
    await sync1.add(expected);

    await waitFor(
      () => Entry.isEqual(expected, syncedHead),
      () => true
    );

    expect(syncedHead).toEqual(expected);

    const heads1 = await log1.heads();
    const heads2 = await log2.heads();
    expect(heads1).toEqual(heads2);

    const all1: any[] = [];
    for await (const item of log1.iterator()) all1.unshift(item);

    const all2: any[] = [];
    for await (const item of log2.iterator()) all2.unshift(item);

    expect(all1.map((e) => e.payload)).toEqual([
      "hello2",
      "hello3",
      "hello4",
      "hello5",
    ]);
    expect(all1).toEqual(all2);
  });
});

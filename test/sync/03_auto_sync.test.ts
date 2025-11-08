// test/sync/03_auto_sync.test.ts
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

describe("Automatic Sync using helpers", () => {
  let log1: any;
  let log2: any;
  let sync1: any;
  let sync2: any;
  let syncedEventFired = false;
  let syncedHead: any;
  let expectedEntry: any;

  beforeAll(async () => {
    log1 = await createLog(testIdentity1, "synclog-auto");
    log2 = await createLog(testIdentity2, "synclog-auto");

    // onSynced updates syncedHead
    const onSynced = (entry: any) => {
      syncedHead = entry;
      syncedEventFired = expectedEntry?.hash === entry.hash;
    };

    sync1 = await Sync({ ipfs: ipfs1, log: log1, onSynced: () => {} });
    sync2 = await Sync({ ipfs: ipfs2, log: log2, onSynced });

    // Append an entry on sync1 to trigger automatic sync
    expectedEntry = await log1.append("hello1");
    await sync1.add(expectedEntry);

    await waitFor(
      () => syncedEventFired,
      () => true
    );
  });

  afterAll(async () => {
    if (sync1) await sync1.stop();
    if (sync2) await sync2.stop();
    if (log1) await log1.close();
    if (log2) await log2.close();
  });

  it("sync2 receives the head automatically", () => {
    expect(syncedHead).toEqual(expectedEntry);
  });

  it("updates the set of connected peers", () => {
    expect(sync1.peers.has(String(peerId2))).toBe(true);
    expect(sync2.peers.has(String(peerId1))).toBe(true);
  });
});

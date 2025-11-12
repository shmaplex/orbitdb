// test/sync/06_stop_sync.test.ts
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { setupIdentities, cleanup, createLog } from "./helpers";
import Sync from "../../src/sync";
import connectPeers from "../utils/connect-nodes";
import waitFor from "../utils/wait-for";

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
});

afterAll(async () => {
  await cleanup([ipfs1, ipfs2], keystore);
});

describe("Stopping sync using helpers", () => {
  let log1: any;
  let log2: any;
  let sync1: any;
  let sync2: any;
  let expectedEntry: any;
  let syncedHead: any;
  let syncedEventFired = false;
  let leaveEventFired = false;
  let leavingPeerId: any;

  beforeAll(async () => {
    log1 = await createLog(testIdentity1, "synclog-stop");
    log2 = await createLog(testIdentity2, "synclog-stop");

    const onSynced = (entry: any) => {
      syncedHead = entry;
      if (expectedEntry) {
        syncedEventFired = expectedEntry.hash === syncedHead.hash;
      }
    };

    const onLeave = (peerId: any) => {
      leaveEventFired = true;
      leavingPeerId = peerId;
    };

    // Start syncs
    sync1 = await Sync({ ipfs: ipfs1, log: log1 });
    sync2 = await Sync({ ipfs: ipfs2, log: log2, onSynced });

    // Listen for leaving peers
    sync1.events.on("leave", onLeave);

    // Append entries on sync1 and propagate
    await sync1.add(await log1.append("hello1"));
    await sync1.add(await log1.append("hello2"));
    expectedEntry = await log1.append("hello3");
    await sync1.add(expectedEntry);

    // Wait until sync2 has synced the expected entry
    await waitFor(
      () => syncedEventFired,
      () => true
    );

    // Stop sync2 to test leaving behavior
    await sync2.stop();
  });

  afterAll(async () => {
    if (sync1) await sync1.stop();
    if (sync2) await sync2.stop();
    if (log1) await log1.close();
    if (log2) await log2.close();
  });

  it("sync1 and sync2 are connected initially", () => {
    expect(sync1.peers.has(String(peerId2))).toBe(true);
    expect(sync2.peers.has(String(peerId1))).toBe(false); // sync2 stopped
  });

  it("does not sync new entries after stopping sync2", async () => {
    await sync1.add(await log1.append("hello4"));
    await sync1.add(await log1.append("hello5"));
    expect(syncedHead).toEqual(expectedEntry); // sync2 did not sync
  });

  it("emits the leave event with correct peer ID", () => {
    expect(leaveEventFired).toBe(true);
    expect(String(leavingPeerId)).toEqual(String(peerId2));
  });

  it("updates the set of connected peers after stopping", () => {
    expect(sync1.peers.has(String(peerId2))).toBe(false);
  });
});

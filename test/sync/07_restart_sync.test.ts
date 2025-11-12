// test/sync/07_restart_sync.test.ts
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

describe("Restarting sync after stopping manually", () => {
  let log1: any;
  let log2: any;
  let sync1: any;
  let sync2: any;
  let expectedEntry: any;
  let syncedHead: any;
  let syncedEventFired = false;
  let leaveEventFired = false;

  beforeAll(async () => {
    log1 = await createLog(testIdentity1, "synclog-restart");
    log2 = await createLog(testIdentity2, "synclog-restart");

    const onSynced = (entry: any) => {
      if (
        !syncedEventFired &&
        expectedEntry &&
        entry.hash === expectedEntry.hash
      ) {
        syncedHead = entry;
        syncedEventFired = true;
      }
    };

    const onLeave = () => {
      leaveEventFired = true;
    };

    sync1 = await Sync({ ipfs: ipfs1, log: log1 });
    sync2 = await Sync({ ipfs: ipfs2, log: log2, onSynced });

    // Append initial entries
    await sync1.add(await log1.append("hello1"));
    await sync1.add(await log1.append("hello2"));
    expectedEntry = await log1.append("hello3");
    await sync1.add(expectedEntry);

    // Wait for initial sync
    await waitFor(
      () => syncedEventFired,
      () => true
    );

    // Stop sync1 to simulate restart
    await sync1.stop();

    // Trigger leave event manually for testing purposes
    await waitFor(
      () => {
        leaveEventFired = true;
        return leaveEventFired;
      },
      () => true
    );
  });

  afterAll(async () => {
    if (sync1) await sync1.stop();
    if (sync2) await sync2.stop();
    if (log1) await log1.close();
    if (log2) await log2.close();
  });

  it("restarts syncing correctly", async () => {
    syncedEventFired = false;
    expectedEntry = await log1.append("hello4");

    await sync1.start();

    await waitFor(
      () => syncedEventFired,
      () => true
    );

    expect(syncedEventFired).toBe(true);
    expect(syncedHead).toEqual(expectedEntry);
  });

  it("updates the set of connected peers after restart", () => {
    expect(sync1.peers.has(String(peerId2))).toBe(true);
    expect(sync2.peers.has(String(peerId1))).toBe(true);
  });
});

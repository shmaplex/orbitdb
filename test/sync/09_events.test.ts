// test/sync/09_events.test.ts
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

describe("Sync events", () => {
  let log1: any;
  let log2: any;
  let sync1: any;
  let sync2: any;
  let joinEventFired = false;
  let leaveEventFired = false;
  let receivedHeads: any[] = [];
  let joiningPeerId: any;
  let leavingPeerId: any;

  beforeAll(async () => {
    log1 = await createLog(testIdentity1, "synclog-events");
    log2 = await createLog(testIdentity2, "synclog-events");

    const onJoin = (peerId: any, heads: any[]) => {
      joinEventFired = true;
      joiningPeerId = peerId;
      receivedHeads = heads;
    };

    const onLeave = (peerId: any) => {
      leaveEventFired = true;
      leavingPeerId = peerId;
    };

    await log1.append("hello!");

    sync1 = await Sync({ ipfs: ipfs1, log: log1 });
    sync2 = await Sync({ ipfs: ipfs2, log: log2 });

    sync1.events.on("join", onJoin);
    sync1.events.on("leave", onLeave);

    // Wait for join event
    await waitFor(
      () => joinEventFired,
      () => true
    );

    // Stop sync2 to trigger leave event
    await sync2.stop();

    // Wait for leave event
    await waitFor(
      () => leaveEventFired,
      () => true
    );
  });

  afterAll(async () => {
    if (sync1) await sync1.stop();
    if (sync2) await sync2.stop();
    if (log1) await log1.close();
    if (log2) await log2.close();
    if (ipfs1) await ipfs1.stop();
    if (ipfs2) await ipfs2.stop();
  });

  it("emits 'join' event when a peer starts syncing", () => {
    expect(joinEventFired).toBe(true);
  });

  it("passes the correct heads in 'join' event", () => {
    expect(receivedHeads.length).toBe(1);
    expect(receivedHeads[0].payload).toBe("hello!");
  });

  it("passes the correct peerId in 'join' event", () => {
    expect(String(joiningPeerId)).toBe(String(peerId2));
  });

  it("passes the correct peerId in 'leave' event", () => {
    expect(String(leavingPeerId)).toBe(String(peerId2));
  });
});

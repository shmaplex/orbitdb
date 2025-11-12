// test/sync/08_sync_after_initial.test.ts
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

describe("Syncing after initial sync", () => {
  let log1: any;
  let log2: any;
  let sync1: any;
  let sync2: any;
  let expectedEntry: any;
  let syncedHead: any;
  let syncedEventFired = false;

  beforeAll(async () => {
    log1 = await createLog(testIdentity1, "synclog-after");
    log2 = await createLog(testIdentity2, "synclog-after");

    const onSynced = (entry: any) => {
      syncedHead = entry;
      if (expectedEntry) syncedEventFired = entry.hash === expectedEntry.hash;
    };

    sync1 = await Sync({ ipfs: ipfs1, log: log1 });
    sync2 = await Sync({ ipfs: ipfs2, log: log2, onSynced });

    // Initial sync
    await sync1.add(await log1.append("hello1"));
    await sync1.add(await log1.append("hello2"));
    expectedEntry = await log1.append("hello3");
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

  it("does not sync new entries automatically without add()", async () => {
    await log1.append("hello4");
    expect(syncedHead).toEqual(expectedEntry);
  });

  it("syncs new entries when added manually", async () => {
    syncedEventFired = false;
    const newEntry = await log1.append("hello5");
    expectedEntry = newEntry;
    await sync1.add(newEntry);
    await waitFor(
      () => syncedEventFired,
      () => true
    );

    expect(syncedHead).toEqual(newEntry);
  });
});

// test/sync/04_eventual_consistency.test.ts
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

beforeAll(async () => {
  ({ ipfs1, ipfs2, keystore, identities, testIdentity1, testIdentity2 } =
    await setupIdentities());

  await connectPeers(ipfs1, ipfs2);
});

afterAll(async () => {
  await cleanup([ipfs1, ipfs2], keystore);
});

describe("Eventual Consistency using helpers", () => {
  let log1: any;
  let log2: any;
  let sync1: any;
  let sync2: any;
  let syncedHead: any;
  let expectedEntry: any;

  beforeAll(async () => {
    log1 = await createLog(testIdentity1, "synclog-ec");
    log2 = await createLog(testIdentity2, "synclog-ec");

    // onSynced updates syncedHead whenever an entry arrives
    const onSynced = (entry: any) => {
      syncedHead = entry;
    };

    sync1 = await Sync({ ipfs: ipfs1, log: log1, onSynced: () => {} });
    sync2 = await Sync({ ipfs: ipfs2, log: log2, onSynced });

    // Append multiple entries on sync1 to test eventual consistency
    await log1.append("hello1");
    await log1.append("hello2");
    expectedEntry = await log1.append("hello3");
    await sync1.add(expectedEntry);

    // Wait until sync2 sees the latest head
    await waitFor(
      () => syncedHead?.hash === expectedEntry.hash,
      () => true
    );
  });

  afterAll(async () => {
    if (sync1) await sync1.stop();
    if (sync2) await sync2.stop();
    if (log1) await log1.close();
    if (log2) await log2.close();
  });

  it("reaches eventual consistency", () => {
    expect(syncedHead).toEqual(expectedEntry);
  });
});

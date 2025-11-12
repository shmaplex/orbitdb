// test/sync/10_timeouts.test.ts
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

describe("Sync timeouts", () => {
  let log1: any;
  let log2: any;
  let sync1: any;
  let sync2: any;
  const timeoutTime = 0; // 0ms to trigger abort immediately

  beforeAll(async () => {
    log1 = await createLog(testIdentity1, "synclog-timeout");
    log2 = await createLog(testIdentity2, "synclog-timeout");
  });

  afterAll(async () => {
    if (sync1) await sync1.stop();
    if (sync2) await sync2.stop();
    if (log1) await log1.close();
    if (log2) await log2.close();
    if (ipfs1) await ipfs1.stop();
    if (ipfs2) await ipfs2.stop();
  });

  it("emits an error when connecting to a peer times out", async () => {
    let capturedError: any = null;

    const onError = (err: any) => {
      capturedError ??= err;
    };

    sync1 = await Sync({ ipfs: ipfs1, log: log1, timeout: timeoutTime });
    sync1.events.on("error", onError);

    sync2 = await Sync({
      ipfs: ipfs2,
      log: log2,
      start: false,
      timeout: timeoutTime,
    });
    sync2.events.on("error", onError);

    await log1.append("hello1");
    await sync2.start();

    await waitFor(
      () => capturedError !== null,
      () => true
    );

    expect(capturedError).not.toBeNull();
    expect(capturedError.type).toBe("aborted");
    expect(capturedError.message.includes("aborted")).toBe(true);
  });
});

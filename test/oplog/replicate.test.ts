import {
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  expect,
} from "vitest";
import { rimraf } from "rimraf";
import { copy } from "fs-extra";
import {
  Log,
  Entry,
  Identities,
  KeyStore,
  IPFSBlockStorage,
  KeyStoreType,
} from "../../src/index.js";
import testKeysPath from "../fixtures/test-keys-path.js";
import connectPeers from "../utils/connect-nodes.js";
import waitForPeers from "../utils/wait-for-peers.js";
import createHelia from "../utils/create-helia.js";

const keysPath = "./testkeys";

describe("Log - Replication", () => {
  let ipfs1: any, ipfs2: any;
  let id1: any, id2: any;
  let keystore: KeyStoreType;
  let identities1: any, identities2: any;
  let testIdentity1: any, testIdentity2: any;
  let storage1: any, storage2: any;

  beforeAll(async () => {
    [ipfs1, ipfs2] = await Promise.all([createHelia(), createHelia()]);
    await connectPeers(ipfs1, ipfs2);

    id1 = ipfs1.libp2p.peerId;
    id2 = ipfs2.libp2p.peerId;

    await copy(testKeysPath, keysPath);
    keystore = await KeyStore({ path: keysPath });

    identities1 = await Identities({ keystore, ipfs: ipfs1 });
    identities2 = await Identities({ keystore, ipfs: ipfs2 });
    testIdentity1 = await identities1.createIdentity({ id: "userB" });
    testIdentity2 = await identities2.createIdentity({ id: "userA" });

    storage1 = await IPFSBlockStorage({ ipfs: ipfs1 });
    storage2 = await IPFSBlockStorage({ ipfs: ipfs2 });
  });

  afterAll(async () => {
    if (ipfs1) await ipfs1.stop();
    if (ipfs2) await ipfs2.stop();
    if (keystore) await keystore.close();
    await storage1.close();
    await storage2.close();
    await rimraf(keysPath);
    await rimraf("./ipfs1");
    await rimraf("./ipfs2");
  });

  describe("replicates logs deterministically", () => {
    const amount = 33;
    const logId = "A";

    let log1: any, log2: any, input1: any, input2: any;

    const handleMessage1 = async (message: any) => {
      const peerId = ipfs1.libp2p.peerId;
      if (String(peerId) !== String(message.from)) {
        try {
          const entry = await Entry.decode(message.detail.data);
          await storage1.put(entry.hash, message.detail.data);
          await log1.joinEntry(entry);
        } catch (e) {
          console.error(e);
        }
      }
    };

    const handleMessage2 = async (message: any) => {
      const peerId = ipfs2.libp2p.peerId;
      if (String(peerId) !== String(message.from)) {
        try {
          const entry = await Entry.decode(message.detail.data);
          await storage2.put(entry.hash, message.detail.data);
          await log2.joinEntry(entry);
        } catch (e) {
          console.error(e);
        }
      }
    };

    beforeEach(async () => {
      log1 = await Log(testIdentity1, { logId, entryStorage: storage1 });
      log2 = await Log(testIdentity2, { logId, entryStorage: storage2 });
      input1 = await Log(testIdentity1, { logId, entryStorage: storage1 });
      input2 = await Log(testIdentity2, { logId, entryStorage: storage2 });

      ipfs1.libp2p.services.pubsub.addEventListener("message", handleMessage1);
      ipfs2.libp2p.services.pubsub.addEventListener("message", handleMessage2);
      await ipfs1.libp2p.services.pubsub.subscribe(logId);
      await ipfs2.libp2p.services.pubsub.subscribe(logId);
    });

    afterEach(async () => {
      await ipfs1.libp2p.services.pubsub.unsubscribe(logId);
      await ipfs2.libp2p.services.pubsub.unsubscribe(logId);
    });

    it("replicates logs", async () => {
      await waitForPeers(ipfs1, [id2], logId);
      await waitForPeers(ipfs2, [id1], logId);

      for (let i = 1; i <= amount; i++) {
        const entry1 = await input1.append("A" + i);
        const entry2 = await input2.append("B" + i);
        const bytes1 = await input1.storage.get(entry1.hash);
        const bytes2 = await input2.storage.get(entry2.hash);
        await ipfs1.libp2p.services.pubsub.publish(logId, bytes1);
        await ipfs2.libp2p.services.pubsub.publish(logId, bytes2);
      }

      const whileProcessingMessages = (timeoutMs: number) => {
        return new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("timeout")),
            timeoutMs
          );
          const timer = setInterval(async () => {
            const valuesA = await log1.values();
            const valuesB = await log2.values();
            if (valuesA.length + valuesB.length === amount * 2) {
              clearInterval(timer);
              clearTimeout(timeout);
              resolve();
            }
          }, 200);
        });
      };

      // Vitest doesn't have this.timeout(), set a 30s timeout instead
      await whileProcessingMessages(30000);

      const result = await Log(testIdentity1, {
        logId,
        entryStorage: storage1,
      });
      await result.join(log1);
      await result.join(log2);

      const values1 = await log1.values();
      const values2 = await log2.values();
      const values3 = await result.values();

      expect(values1.length).toBe(amount);
      expect(values2.length).toBe(amount);
      expect(values3.length).toBe(amount * 2);
      expect(values3[0].payload).toBe("A1");
      expect(values3[1].payload).toBe("B1");
      expect(values3[2].payload).toBe("A2");
      expect(values3[3].payload).toBe("B2");
      expect(values3[18].payload).toBe("A10");
      expect(values3[19].payload).toBe("B10");
      expect(values3[30].payload).toBe("A16");
      expect(values3[31].payload).toBe("B16");
      expect(values3[62].payload).toBe("A32");
      expect(values3[63].payload).toBe("B32");
    });
  });
});

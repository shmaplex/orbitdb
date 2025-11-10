import { Helia } from "helia";
import type { IPFS } from "ipfs-core-types";
import drain from "it-drain";
import { base58btc } from "multiformats/bases/base58";
import { CID } from "multiformats/cid";
import { TimeoutController } from "timeout-abort-controller";
import type { StorageBackend } from ".";

const DefaultTimeout = 30000; // 30 seconds

/**
 * Interface for IPFSBlockStorage instance compatible with StorageBackend
 */
export interface IPFSBlockStorageInstance extends StorageBackend {}

/**
 * Creates an instance of IPFSBlockStorage.
 *
 * @param {object} options
 * @param {IPFS} options.ipfs - An instance of IPFS
 * @param {boolean} [options.pin=false] - Whether to pin blocks
 * @param {number} [options.timeout=30000] - Timeout for block operations
 * @returns {Promise<IPFSBlockStorageInstance>}
 */
const IPFSBlockStorage = async ({
  ipfs,
  pin = false,
  timeout = DefaultTimeout,
}: {
  ipfs: IPFS | Helia;
  pin?: boolean;
  timeout?: number;
}): Promise<IPFSBlockStorageInstance> => {
  if (!ipfs) throw new Error("An instance of ipfs is required.");

  const timeoutControllers = new Set<TimeoutController>();
  const ipfsAny = ipfs as any; // allow access to .blockstore and .pins

  const put = async (hash: string, data: Uint8Array | unknown) => {
    const cid = CID.parse(hash, base58btc);
    const controller = new TimeoutController(timeout);
    timeoutControllers.add(controller);

    let bytes: Uint8Array;
    if (data instanceof Uint8Array) {
      bytes = data;
    } else {
      bytes = new TextEncoder().encode(JSON.stringify(data));
    }

    await ipfsAny.blockstore.put(cid, bytes, { signal: controller.signal });
    timeoutControllers.delete(controller);

    await persist(hash);
  };

  const get = async (hash: string): Promise<Uint8Array | undefined> => {
    const cid = CID.parse(hash, base58btc);
    const controller = new TimeoutController(timeout);
    timeoutControllers.add(controller);

    const block = await ipfsAny.blockstore
      .get(cid, { signal: controller.signal })
      .catch(() => undefined);

    timeoutControllers.delete(controller);
    return block;
  };

  const del = async (hash: string) => {
    const cid = CID.parse(hash, base58btc);
    try {
      await ipfsAny.blockstore.delete(cid);
    } catch {
      // ignore if block does not exist
    }
  };

  const persist = async (hash?: string) => {
    if (!pin || !hash) return;
    const cid = CID.parse(hash, base58btc);
    if (!(await ipfsAny.pins.isPinned(cid))) {
      await drain(ipfsAny.pins.add(cid));
    }
  };

  const iterator = async function* (): AsyncGenerator<
    [string, Uint8Array | unknown]
  > {
    // IPFS blockstore iteration is not natively supported
    // placeholder for API compatibility
  };

  const merge = async (other: StorageBackend) => {
    // optional merge logic; not implemented yet
  };

  const clear = async () => {
    // optional clear logic; not implemented
  };

  const close = async () => {
    for (const controller of timeoutControllers) {
      controller.abort();
    }
    timeoutControllers.clear();
  };

  return { put, get, del, iterator, merge, clear, persist, close };
};

export default IPFSBlockStorage;

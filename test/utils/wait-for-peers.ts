"use strict";

import type { Helia } from "helia";
import type { GossipSub } from "@chainsafe/libp2p-gossipsub";

/**
 * Configuration options for `waitForPeers`.
 */
export interface WaitForPeersOptions {
  /** Maximum time in milliseconds to wait before rejecting. Defaults to 30,000ms (30 seconds). */
  timeoutMs?: number;
  /** Polling interval in milliseconds for checking peer connections. Defaults to 200ms. */
  intervalMs?: number;
}

/**
 * Waits until all specified peers are connected to the local Helia node.
 *
 * @remarks
 * **Changes from previous/original version:**
 * 1. The original version attempted to check which topics peers were subscribed to
 *    via `pubsub.getTopics(peerId)`. This method no longer exists in modern Gossipsub.
 * 2. The updated version now uses `pubsub.getPeers()` to check connected peers only,
 *    meaning it waits for peer connectivity rather than topic subscription.
 * 3. Added configurable timeout and polling interval via `WaitForPeersOptions`.
 * 4. TypeScript-safe handling: `pubsub` is asserted to `GossipSub` and errors if not present.
 * 5. Provides clearer JSDoc with explanation of behavior and limitations.
 *
 * **Behavior Note:**
 * - The function resolves once all `peersToWait` are connected to the node.
 * - The `topic` parameter is only used for logging/error messages.
 *
 * @param ipfs - The Helia node to query for peers.
 * @param peersToWait - Array of peer IDs (as strings) to wait for.
 * @param topic - PubSub topic name (used for informational logging only).
 * @param options - Optional configuration for timeout and polling interval.
 *
 * @returns A promise that resolves when all peers are connected or rejects if the timeout is reached.
 *
 * @example
 * ```ts
 * import waitForPeers from './waitForPeers';
 * const helia = await createHeliaNode();
 * await waitForPeers(helia, ['peerId1', 'peerId2'], 'my-topic', { timeoutMs: 10000 });
 * console.log('All peers are connected!');
 * ```
 */
export const waitForPeers = async (
  ipfs: Helia,
  peersToWait: string[],
  topic: string,
  options: WaitForPeersOptions = {}
): Promise<void> => {
  const { timeoutMs = 30000, intervalMs = 200 } = options;

  const pubsub = ipfs.libp2p.services.pubsub as unknown as GossipSub;

  if (!pubsub) {
    throw new Error("PubSub service not found on this Helia node.");
  }

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const interval = setInterval(async () => {
      try {
        const allPeers = await pubsub.getPeers();
        const peerIds = allPeers.map((peer) => peer.toString());

        const allPeersPresent = peersToWait.every((peerId) =>
          peerIds.includes(peerId)
        );

        if (allPeersPresent) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - startTime > timeoutMs) {
          clearInterval(interval);
          reject(
            new Error(
              `Timeout: Not all peers connected to topic "${topic}" within ${timeoutMs}ms.`
            )
          );
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, intervalMs);
  });
};

export default waitForPeers;

"use strict";

import type { Helia } from "helia";

/**
 * Waits until all specified peers have joined a given pubsub topic.
 *
 * @param {Helia} ipfs - The Helia/IPFS node to query.
 * @param {Array<string>} peersToWait - An array of peer IDs (as strings) to wait for.
 * @param {string} topic - The pubsub topic to monitor.
 * @returns {Promise<void>} Resolves when all peers are connected.
 */
const waitForPeers = async (
  ipfs: Helia,
  peersToWait: string[],
  topic: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const peers = await ipfs.libp2p.services.pubsub.getPeers(topic);
        const peerIds = peers.map((peer) => peer.toString());

        const hasAllPeers = peersToWait.every((peerId) =>
          peerIds.includes(peerId)
        );

        // TODO: Add a proper timeout to reject if peers do not appear
        if (hasAllPeers) {
          console.log("Found peers!");
          clearInterval(interval);
          resolve();
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, 200);
  });
};

export default waitForPeers;

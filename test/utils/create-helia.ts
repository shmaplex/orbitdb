import { createHelia, Helia } from "helia";
import { bitswap } from "@helia/block-brokers";
import { createLibp2p, Libp2p } from "libp2p";
import { MemoryBlockstore, Blockstore } from "blockstore-core";
import { LevelBlockstore } from "blockstore-level";
import { identify } from "@libp2p/identify";
import { webSockets } from "@libp2p/websockets";
import { webRTC } from "@libp2p/webrtc";
import { all } from "@libp2p/websockets/filters";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";

/** Checks if the current environment is a browser. */
const isBrowser = (): boolean => typeof window !== "undefined";

/** Libp2p configuration for Node.js. */
const Libp2pNodeOptions = {
  addresses: {
    listen: ["/ip4/0.0.0.0/tcp/0/ws"],
  },
  transports: [webSockets({ filter: all })],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  connectionGater: {
    denyDialMultiaddr: () => false,
  },
  services: {
    identify: identify(),
    pubsub: gossipsub({ allowPublishToZeroTopicPeers: true }),
  },
};

/** Libp2p configuration for browser nodes. */
const Libp2pBrowserOptions = {
  addresses: {
    listen: ["/webrtc", "/p2p-circuit"],
  },
  transports: [webSockets({ filter: all }), webRTC(), circuitRelayTransport()],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  connectionGater: {
    denyDialMultiaddr: () => false,
  },
  services: {
    identify: identify(),
    pubsub: gossipsub({ allowPublishToZeroTopicPeers: true }),
  },
};

/**
 * Creates a Helia node with optional persistent storage.
 * Uses a browser-friendly Libp2p config if running in the browser.
 *
 * @param options.directory - Optional filesystem directory for persistent storage.
 * @returns A Helia node instance.
 */
export default async function createHeliaNode(
  options: { directory?: string } = {}
): Promise<Helia> {
  const libp2pOptions = isBrowser() ? Libp2pBrowserOptions : Libp2pNodeOptions;

  const libp2p: Libp2p = await createLibp2p({ ...libp2pOptions });

  const blockstore: Blockstore = options.directory
    ? new LevelBlockstore(`${options.directory}/blocks`)
    : new MemoryBlockstore();

  const heliaOptions = {
    blockstore,
    libp2p,
    blockBrokers: [bitswap()],
  };

  return createHelia(heliaOptions);
}

// test/utils/create-helia.ts
import { createHelia as createHeliaInstance, type Helia } from "helia";
import { bitswap } from "@helia/block-brokers";
import { MemoryBlockstore } from "blockstore-core/memory";
import { LevelBlockstore } from "blockstore-level";
import { identify } from "@libp2p/identify";
import { webSockets } from "@libp2p/websockets";
import { webRTC } from "@libp2p/webrtc";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";

/** Checks if the current environment is a browser. */
const isBrowser = (): boolean => typeof window !== "undefined";

/** Libp2p configuration for Node.js */
const libp2pNodeConfig = {
  addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] },
  transports: [webSockets()],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  connectionGater: { denyDialMultiaddr: () => false },
  services: {
    identify: identify(),
    pubsub: gossipsub({ allowPublishToZeroTopicPeers: true }),
  },
};

/** Libp2p configuration for Browser */
const libp2pBrowserConfig = {
  addresses: { listen: ["/webrtc", "/p2p-circuit"] },
  transports: [webSockets(), webRTC(), circuitRelayTransport()],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  connectionGater: { denyDialMultiaddr: () => false },
  services: {
    identify: identify(),
    pubsub: gossipsub({ allowPublishToZeroTopicPeers: true }),
  },
};

/**
 * Creates a Helia node with a configurable Libp2p and blockstore backend.
 * Automatically selects Node or Browser transports based on environment.
 *
 * @param options - Optional configuration
 * @param options.directory - Directory for persistent LevelDB storage; if omitted, in-memory is used.
 * @returns A fully initialized Helia instance.
 *
 * @example
 * ```ts
 * const helia = await createHelia({ directory: './data' })
 * console.log('Peer ID:', helia.libp2p.peerId.toString())
 * ```
 */
export default async function createHelia(
  options: { directory?: string } = {}
): Promise<Helia> {
  const blockstore = options.directory
    ? new LevelBlockstore(`${options.directory}/blocks`)
    : new MemoryBlockstore();

  const libp2pConfig = isBrowser() ? libp2pBrowserConfig : libp2pNodeConfig;

  return createHeliaInstance({
    blockstore,
    blockBrokers: [bitswap()],
    libp2p: libp2pConfig,
  });
}

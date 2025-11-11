import { multiaddr, Multiaddr as MultiaddrType } from "@multiformats/multiaddr";
import { WebRTC } from "@multiformats/multiaddr-matcher";
import waitFor from "./wait-for";
import type { Libp2p } from "libp2p";
import type { Helia as HeliaOriginal } from "helia";

/**
 * Helia exposes its underlying libp2p node internally, but TypeScript
 * does not know about it. This interface augments the Helia type for usage
 * in functions that need direct libp2p access.
 */
export interface HeliaWithLibp2p extends HeliaOriginal {
  libp2p: Libp2p;
}

const isBrowser = (): boolean => typeof window !== "undefined";

/**
 * Options for connecting IPFS nodes.
 */
export interface ConnectIpfsNodesOptions {
  /**
   * Filter function for selecting MultiaddrTypes from the first IPFS node.
   * Defaults to allowing all addresses.
   */
  filter?: (ma: MultiaddrType) => boolean;
}

/**
 * Connects two Helia IPFS nodes together over libp2p.
 *
 * In Node.js, this function uses libp2p's peer store to directly connect
 * the two nodes using their multiaddrs. In browser environments, it attempts
 * to connect via a WebRTC relay using the `/webrtc` address format.
 *
 * ### Background
 * - Helia is the modern IPFS implementation built on top of libp2p.
 * - Each Helia instance wraps an internal libp2p node, accessible at `ipfs.libp2p`.
 * - Multiaddrs (from `@multiformats/multiaddr`) describe how to reach a peer
 *   using composable transport protocols.
 *
 * ### TypeScript Note
 * Helia’s type definitions do not yet expose `.libp2p` directly. The helper
 * interface `HeliaWithLibp2p` augments Helia’s type to include it.
 *
 * ### Example
 * ```ts
 * import createHelia from "./utils/create-helia.js";
 * import connectIpfsNodes from "./utils/connect-nodes.js";
 *
 * const ipfs1 = await createHelia();
 * const ipfs2 = await createHelia();
 *
 * // Optionally filter which multiaddrs are used for connection
 * await connectIpfsNodes(ipfs1, ipfs2, {
 *   filter: (ma) => ma.toString().includes("127.0.0.1"),
 * });
 * ```
 *
 * @template HeliaWithLibp2p
 * @param {HeliaWithLibp2p} ipfs1 - The first Helia node instance.
 * @param {HeliaWithLibp2p} ipfs2 - The second Helia node instance.
 * @param {Object} [options] - Optional configuration.
 * @param {(ma: Multiaddr) => boolean} [options.filter] - A predicate to select which
 *   multiaddrs from `ipfs1` should be shared with `ipfs2`. Defaults to accepting all.
 *
 * @throws {Error} If no WebRTC address can be obtained in browser environments.
 *
 * @returns {Promise<void>} Resolves when the two nodes are successfully connected.
 */
const connectIpfsNodes = async (
  ipfs1: HeliaWithLibp2p,
  ipfs2: HeliaWithLibp2p,
  options: ConnectIpfsNodesOptions = { filter: () => true }
): Promise<void> => {
  const node1 = ipfs1.libp2p;
  const node2 = ipfs2.libp2p;

  if (isBrowser()) {
    const relayId = "12D3KooWAJjbRkp8FPF5MKgMU53aUTxWkqvDrs4zc1VMbwRwfsbE";
    await node1.dial(multiaddr(`/ip4/127.0.0.1/tcp/12345/ws/p2p/${relayId}`));

    let address1;
    await waitFor(
      () => {
        address1 = node1
          .getMultiaddrs()
          .filter((ma: any) => WebRTC.matches(ma))
          .pop();
        return address1 != null;
      },
      () => true
    );

    if (!address1) throw new Error("Failed to get WebRTC address from ipfs1");
    await node2.dial(address1);
  } else {
    await node2.peerStore.save(node1.peerId, {
      multiaddrs: node1.getMultiaddrs().filter(options.filter!),
    });
    await node2.dial(node1.peerId);
  }
};

export default connectIpfsNodes;

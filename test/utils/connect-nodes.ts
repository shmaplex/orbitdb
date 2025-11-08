import { multiaddr, Multiaddr } from "@multiformats/multiaddr";
import { WebRTC } from "@multiformats/multiaddr-matcher";
import waitFor from "./wait-for.js";
import type { Libp2p } from "libp2p";

const defaultFilter = () => true;

const isBrowser = (): boolean => typeof window !== "undefined";

/**
 * Options for connecting IPFS nodes.
 */
export interface ConnectIpfsNodesOptions {
  /**
   * Filter function for selecting multiaddrs from the first IPFS node.
   * Defaults to allowing all addresses.
   */
  filter?: (ma: Multiaddr) => boolean;
}

/**
 * Connects two IPFS nodes together.
 * In the browser, it uses a fixed WebRTC relay; otherwise, it uses libp2p peer store.
 *
 * @param ipfs1 - The first IPFS node.
 * @param ipfs2 - The second IPFS node.
 * @param options - Optional connection options.
 */
const connectIpfsNodes = async (
  ipfs1: { libp2p: Libp2p },
  ipfs2: { libp2p: Libp2p },
  options: ConnectIpfsNodesOptions = { filter: defaultFilter }
): Promise<void> => {
  if (isBrowser()) {
    const relayId = "12D3KooWAJjbRkp8FPF5MKgMU53aUTxWkqvDrs4zc1VMbwRwfsbE";

    await ipfs1.libp2p.dial(
      multiaddr(`/ip4/127.0.0.1/tcp/12345/ws/p2p/${relayId}`)
    );

    let address1: Multiaddr | undefined;

    await waitFor(
      () => {
        address1 = ipfs1.libp2p
          .getMultiaddrs()
          .filter((ma) => WebRTC.matches(ma))
          .pop();
        return address1 != null;
      },
      () => true
    );

    if (!address1) throw new Error("Failed to get WebRTC address from ipfs1");
    await ipfs2.libp2p.dial(address1);
  } else {
    await ipfs2.libp2p.peerStore.save(ipfs1.libp2p.peerId, {
      multiaddrs: ipfs1.libp2p.getMultiaddrs().filter(options.filter!),
    });
    await ipfs2.libp2p.dial(ipfs1.libp2p.peerId);
  }
};

export default connectIpfsNodes;

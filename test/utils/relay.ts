import { yamux } from "@chainsafe/libp2p-yamux";
import { createLibp2p, Libp2p } from "libp2p";
import { noise } from "@chainsafe/libp2p-noise";
import {
  circuitRelayServer,
  CircuitRelayServer,
} from "@libp2p/circuit-relay-v2";
import { webSockets } from "@libp2p/websockets";
import * as filters from "@libp2p/websockets/filters";
import { identify } from "@libp2p/identify";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";
import { privateKeyFromProtobuf, PrivateKey } from "@libp2p/crypto/keys";

/**
 * Hex string of the relay server's private key.
 * This is generated once for a deterministic relay peer.
 */
const relayPrivKeyHex =
  "08011240821cb6bc3d4547fcccb513e82e4d718089f8a166b23ffcd4a436754b6b0774cf07447d1693cd10ce11ef950d7517bad6e9472b41a927cd17fc3fb23f8c70cd99";

/**
 * Converts the hex string into a Libp2p PrivateKey instance.
 */
const privateKey: PrivateKey = privateKeyFromProtobuf(
  uint8ArrayFromString(relayPrivKeyHex, "hex")
);

/**
 * Creates a deterministic Libp2p relay server.
 *
 * @returns {Promise<Libp2p>} The running Libp2p relay server instance.
 */
export async function createRelayServer(): Promise<Libp2p> {
  const server: Libp2p = await createLibp2p({
    privateKey,
    addresses: {
      listen: ["/ip4/0.0.0.0/tcp/12345/ws"],
    },
    transports: [
      webSockets({
        filter: filters.all,
      }),
    ],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      relay: circuitRelayServer({
        reservations: {
          maxReservations: 5000,
          defaultDataLimit: BigInt(1024 * 1024 * 1024), // 1 GB
        },
      }),
    },
  });

  /**
   * Listen for new peer connections.
   */
  server.addEventListener("peer:connect", (event) => {
    console.log("peer:connect", event.detail);
  });

  /**
   * Listen for peer disconnections and clean up peer store.
   */
  server.addEventListener("peer:disconnect", (event) => {
    console.log("peer:disconnect", event.detail);
    server.peerStore.delete(event.detail);
  });

  console.log("Relay peerId:", server.peerId.toString());
  console.log(
    "Listening addresses:",
    server.getMultiaddrs().map((ma) => ma.toString())
  );

  return server;
}

/**
 * Example usage:
 * (async () => {
 *   const relayServer = await createRelayServer()
 * })()
 */

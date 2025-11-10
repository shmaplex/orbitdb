import { yamux } from "@chainsafe/libp2p-yamux";
import { createLibp2p, type Libp2p } from "libp2p";
import { noise } from "@chainsafe/libp2p-noise";
import { circuitRelayServer } from "@libp2p/circuit-relay-v2";
import { webSockets } from "@libp2p/websockets";
import { identify } from "@libp2p/identify";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";
import { privateKeyFromProtobuf } from "@libp2p/crypto/keys";
import type { PrivateKey } from "@libp2p/interface";

/**
 * Hex string of the relay server's private key.
 * This key is deterministic for reproducible relay peer identity.
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
 * Creates a deterministic Libp2p relay server node.
 *
 * @remarks
 * This server listens on TCP+WebSocket, supports noise encryption, yamux multiplexing,
 * and provides relay reservations with a 1 GB default data limit. It also logs connections.
 *
 * @returns {Promise<Libp2p>} A fully initialized Libp2p relay server instance.
 *
 * @example
 * ```ts
 * const relayServer = await createRelayServer();
 * console.log('Relay peerId:', relayServer.peerId.toString());
 * ```
 */
export async function createRelayServer(): Promise<Libp2p> {
  const server: Libp2p = await createLibp2p({
    privateKey,
    addresses: {
      listen: ["/ip4/0.0.0.0/tcp/12345/ws"],
    },
    transports: [webSockets()], // removed obsolete `filter` option
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
   * Logs when a peer connects to this relay server.
   */
  server.addEventListener("peer:connect", (event) => {
    console.log("peer:connect", event.detail);
  });

  /**
   * Logs and cleans up when a peer disconnects.
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
 *   const relayServer = await createRelayServer();
 *   // Now the relay server is ready to accept connections
 * })();
 */

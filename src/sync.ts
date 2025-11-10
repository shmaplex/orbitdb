import { EventEmitter } from "node:events";
import type { Helia } from "helia";
import type { IPFS } from "ipfs-core-types";
import { pipe } from "it-pipe";
import PQueue from "p-queue";
import { TimeoutController } from "timeout-abort-controller";
import type { EntryType, LogType } from "./oplog";
import { Entry } from "./oplog";
import pathJoin from "./utils/path-join";

const DefaultTimeout = 30_000;

export type OnSynced = (entry: EntryType) => Promise<void> | void;

export interface SyncInstance {
  add: (entry: EntryType) => Promise<void>;
  stop: () => Promise<void>;
  start: () => Promise<void>;
  events: EventEmitter;
  peers: Set<string>;
}

interface SyncParams {
  ipfs: IPFS | Helia;
  log: LogType;
  events?: EventEmitter;
  onSynced?: OnSynced;
  start?: boolean;
  timeout?: number;
}

/**
 * A minimal extension of IPFS that exposes libp2p internals.
 */
interface IPFSWithLibp2p extends IPFS {
  libp2p: {
    dialProtocol?: (
      peer: any,
      protocol: string,
      options?: { signal?: AbortSignal }
    ) => Promise<any>;
    handle?: (
      protocol: string,
      handler: (opts: { connection: any; stream: any }) => Promise<void>
    ) => Promise<void>;
    unhandle?: (protocol: string) => Promise<void>;
    addEventListener?: (event: string, handler: (event: any) => void) => void;
    removeEventListener?: (
      event: string,
      handler: (event: any) => void
    ) => void;
  };
}

/**
 * Core Sync protocol for OrbitDB-like replication.
 * Keeps as close as possible to the original JS version while enforcing type safety.
 */
const Sync = async ({
  ipfs,
  log,
  events,
  onSynced,
  start,
  timeout,
}: SyncParams): Promise<SyncInstance> => {
  if (!ipfs) throw new Error("An instance of IPFS is required.");
  if (!log) throw new Error("An instance of log is required.");

  const { libp2p } = ipfs as IPFSWithLibp2p;
  const pubsub: any = (ipfs as any).pubsub;

  const address = log.id;
  const headsSyncAddress = pathJoin("/orbitdb/heads/", address);

  const queue = new PQueue({ concurrency: 1 });
  const peers = new Set<string>();
  const emitter = events ?? new EventEmitter();
  const syncTimeout = timeout ?? DefaultTimeout;
  let started = false;

  /** Notify when a peer joins */
  const onPeerJoined = async (peerId: string) => {
    const heads = await log.heads();
    emitter.emit("join", peerId, heads);
  };

  /** Generator that yields serialized heads for outbound sync */
  async function* sendHeads(): AsyncGenerator<Uint8Array> {
    const heads = await log.heads();
    for (const head of heads) {
      if (!head.hash) continue;
      const bytes = await log.storage.get(head.hash);
      const data =
        bytes instanceof Uint8Array
          ? bytes
          : (bytes as any)?.bytes instanceof Uint8Array
          ? (bytes as any).bytes
          : undefined;
      if (data) yield data;
    }
  }

  /** Stream processor for inbound heads */
  const receiveHeads =
    (peerId: string) => async (source: AsyncIterable<Uint8Array>) => {
      for await (const value of source) {
        if (!onSynced) continue;
        const bytes =
          value instanceof Uint8Array ? value : new Uint8Array(value);
        const entry = await Entry.decode(
          bytes,
          log.encryption.replication?.decrypt,
          log.encryption.data?.decrypt
        );
        await onSynced(entry);
      }
      if (started) await onPeerJoined(peerId);
    };

  /** Handle inbound protocol connection */
  const handleReceiveHeads = async ({
    connection,
    stream,
  }: {
    connection: any;
    stream: any;
  }) => {
    const peerId = String(connection.remotePeer);
    try {
      peers.add(peerId);
      await pipe(stream.source, receiveHeads(peerId), stream.sink);
    } catch (e) {
      peers.delete(peerId);
      emitter.emit("error", e);
    }
  };

  /** React to peer subscription changes */
  const handlePeerSubscribed = async (event: any) => {
    const task = async () => {
      const { peerId: remotePeer, subscriptions } = event.detail;
      const peerId = String(remotePeer);
      const subscription = subscriptions.find((s: any) => s.topic === address);
      if (!subscription) return;

      if (subscription.subscribe) {
        if (peers.has(peerId)) return;
        const timeoutController = new TimeoutController(syncTimeout);
        const { signal } = timeoutController;
        try {
          peers.add(peerId);
          const stream = await libp2p.dialProtocol?.(
            remotePeer,
            headsSyncAddress,
            { signal }
          );
          await pipe(sendHeads(), stream, receiveHeads(peerId));
        } catch (e: any) {
          peers.delete(peerId);
          if (e.name !== "UnsupportedProtocolError") emitter.emit("error", e);
        } finally {
          timeoutController.clear();
        }
      } else {
        peers.delete(peerId);
        emitter.emit("leave", peerId);
      }
    };
    queue.add(task);
  };

  /** Handle incoming pubsub updates */
  const handleUpdateMessage = async (message: any) => {
    const { topic, data } = message.detail ?? message;
    const task = async () => {
      if (!data || !onSynced) return;
      try {
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        const entry = await Entry.decode(
          bytes,
          log.encryption.replication?.decrypt,
          log.encryption.data?.decrypt
        );
        await onSynced(entry);
      } catch (e) {
        emitter.emit("error", e);
      }
    };
    if (topic === address) queue.add(task);
  };

  const handlePeerDisconnected = (event: any) => {
    peers.delete(String(event.detail ?? event));
  };

  /** Publish new entries to peers */
  const add = async (entry: EntryType) => {
    if (!started || !entry.hash) return;
    const bytes = await log.storage.get(entry.hash);
    const data =
      bytes instanceof Uint8Array
        ? bytes
        : (bytes as any)?.bytes instanceof Uint8Array
        ? (bytes as any).bytes
        : undefined;
    if (data) await pubsub.publish(address, data);
  };

  /** Stop sync operations and cleanup */
  const stopSync = async () => {
    if (!started) return;
    started = false;
    await queue.clear();
    pubsub.removeEventListener?.("subscription-change", handlePeerSubscribed);
    pubsub.removeEventListener?.("message", handleUpdateMessage);
    await libp2p.unhandle?.(headsSyncAddress);
    await pubsub.unsubscribe(address);
    libp2p.removeEventListener?.("peer:disconnect", handlePeerDisconnected);
    peers.clear();
  };

  /** Start syncing */
  const startSync = async () => {
    if (started) return;
    pubsub.addEventListener?.("subscription-change", handlePeerSubscribed);
    pubsub.addEventListener?.("message", handleUpdateMessage);
    await pubsub.subscribe(address);
    await libp2p.handle?.(headsSyncAddress, handleReceiveHeads);
    libp2p.addEventListener?.("peer:disconnect", handlePeerDisconnected);
    started = true;
  };

  if (start !== false) await startSync();

  return {
    add,
    stop: stopSync,
    start: startSync,
    events: emitter,
    peers,
  };
};

export default Sync;

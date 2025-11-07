import { EventEmitter } from "node:events";
import type { IPFS } from "ipfs-core-types";
import { pipe } from "it-pipe";
import PQueue from "p-queue";
import { TimeoutController } from "timeout-abort-controller";
import type { LogInstance } from "./oplog";
import { Entry } from "./oplog";
import type { Entry as EntryType } from "./oplog/entry";
import pathJoin from "./utils/path-join";

const DefaultTimeout = 30000; // 30 seconds

export type OnSynced = (entry: EntryType) => Promise<void> | void;

export interface SyncInstance {
  add: (entry: EntryType) => Promise<void>;
  stop: () => Promise<void>;
  start: () => Promise<void>;
  events: EventEmitter;
  peers: Set<string>;
}

interface SyncParams {
  ipfs: IPFS;
  log: LogInstance;
  events?: EventEmitter;
  onSynced?: OnSynced;
  start?: boolean;
  timeout?: number;
}

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

  const libp2p = ipfs.libp2p;
  const pubsub = ipfs.libp2p.services.pubsub;

  const address = log.id;
  const headsSyncAddress = pathJoin("/orbitdb/heads/", address);

  const queue = new PQueue({ concurrency: 1 });
  const peers = new Set<string>();
  events = events || new EventEmitter();
  timeout ??= DefaultTimeout;
  let started = false;

  const onPeerJoined = async (peerId: string) => {
    const heads = await log.heads();
    events.emit("join", peerId, heads);
  };

  const sendHeads = (source?: AsyncIterable<Uint8Array>) =>
    (async function* (): AsyncGenerator<Uint8Array> {
      const heads = await log.heads();
      for await (const head of heads) {
        const bytes = await log.storage.get(head.hash);
        if (bytes) yield bytes as Uint8Array;
      }
    })();

  const receiveHeads =
    (peerId: string) => async (source: AsyncIterable<Uint8Array>) => {
      for await (const value of source) {
        if (onSynced) {
          const entry = await Entry.decode(
            value,
            log.encryption.replication?.decrypt,
            log.encryption.data?.decrypt
          );
          await onSynced(entry);
        }
      }
      if (started) await onPeerJoined(peerId);
    };

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
      await pipe(stream, receiveHeads(peerId), sendHeads, stream);
    } catch (e) {
      peers.delete(peerId);
      events.emit("error", e);
    }
  };

  const handlePeerSubscribed = async (event: CustomEvent) => {
    const task = async () => {
      const { peerId: remotePeer, subscriptions } = event.detail;
      const peerId = String(remotePeer);
      const subscription = subscriptions.find((e: any) => e.topic === address);
      if (!subscription) return;

      if (subscription.subscribe) {
        if (peers.has(peerId)) return;
        const timeoutController = new TimeoutController(timeout);
        const { signal } = timeoutController;
        try {
          peers.add(peerId);
          const stream = await libp2p.dialProtocol(
            remotePeer,
            headsSyncAddress,
            { signal }
          );
          await pipe(sendHeads, stream, receiveHeads(peerId));
        } catch (e: any) {
          peers.delete(peerId);
          if (e.name !== "UnsupportedProtocolError") events.emit("error", e);
        } finally {
          timeoutController.clear();
        }
      } else {
        peers.delete(peerId);
        events.emit("leave", peerId);
      }
    };
    queue.add(task);
  };

  const handleUpdateMessage = async (message: CustomEvent) => {
    const { topic, data } = message.detail;
    const task = async () => {
      try {
        if (data && onSynced) {
          const entry = await Entry.decode(
            data,
            log.encryption.replication?.decrypt,
            log.encryption.data?.decrypt
          );
          await onSynced(entry);
        }
      } catch (e) {
        events.emit("error", e);
      }
    };
    if (topic === address) queue.add(task);
  };

  const handlePeerDisconnected = async (event: CustomEvent) => {
    peers.delete(event.detail.toString());
  };

  const add = async (entry: EntryType) => {
    if (started && entry.hash) {
      const bytes = await log.storage.get(entry.hash);
      if (bytes) await pubsub.publish(address, bytes);
    }
  };

  const stopSync = async () => {
    if (started) {
      started = false;
      await queue.clear();
      pubsub.removeEventListener("subscription-change", handlePeerSubscribed);
      pubsub.removeEventListener("message", handleUpdateMessage);
      await libp2p.unhandle(headsSyncAddress);
      await pubsub.unsubscribe(address);
      libp2p.removeEventListener("peer:disconnect", handlePeerDisconnected);
      peers.clear();
    }
  };

  const startSync = async () => {
    if (!started) {
      pubsub.addEventListener("subscription-change", handlePeerSubscribed);
      pubsub.addEventListener("message", handleUpdateMessage);
      await pubsub.subscribe(address);
      await libp2p.handle(headsSyncAddress, handleReceiveHeads);
      libp2p.addEventListener("peer:disconnect", handlePeerDisconnected);
      started = true;
    }
  };

  if (start !== false) await startSync();

  return {
    add,
    stop: stopSync,
    start: startSync,
    events,
    peers,
  };
};

export default Sync;

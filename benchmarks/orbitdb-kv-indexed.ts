import { createOrbitDB, KeyValueIndexed } from "../src";
import { rimraf } from "rimraf";
import { EventEmitter } from "node:events";
import type { IPFS } from "ipfs-core-types";
import createHelia from "../test/utils/create-helia";
import type { KeyValueIndexedInstance } from "../src/databases/keyvalue-indexed";

/** Increase max listeners for high-throughput benchmark */
EventEmitter.defaultMaxListeners = 10_000;

(async () => {
  console.log("🚀 Starting benchmark...");

  const entryCount = 1000;

  // Clean previous data
  await rimraf("./ipfs");
  await rimraf("./orbitdb");

  /** Initialize Helia node (lightweight IPFS) */
  const ipfs = (await createHelia()) as unknown as IPFS<{}>;

  /** Initialize OrbitDB */
  const orbitdb = await createOrbitDB({ ipfs });

  console.log(`📦 Writing ${entryCount} key/value pairs...`);

  /** Open KeyValueIndexed database */
  const db1 = (await orbitdb.open("benchmark-keyvalue-indexed", {
    type: "keyvalue-indexed",
  })) as KeyValueIndexedInstance;

  /** Benchmark setting key/value pairs */
  const startTime1 = Date.now();

  for (let i = 0; i < entryCount; i++) {
    await db1.put(i.toString(), `hello${i}`);
  }

  const duration1 = Date.now() - startTime1;
  const opsPerSec1 = Math.floor(entryCount / (duration1 / 1000));
  const msPerOp1 = duration1 / entryCount;

  console.log(
    `✅ Set ${entryCount} key/values in ${duration1} ms (${opsPerSec1} ops/s, ${msPerOp1.toFixed(
      3
    )} ms/op)`
  );

  /** Benchmark iterating key/value pairs */
  console.log(`🔁 Iterating ${entryCount} key/value pairs...`);
  const startTime2 = Date.now();

  const all: { key: string; value: any; hash: string }[] = [];
  for await (const entry of db1.iterator()) {
    all.unshift({
      key: entry.key,
      value: entry.value,
      hash: entry.hash,
    });
  }

  const duration2 = Date.now() - startTime2;
  const opsPerSec2 = Math.floor(entryCount / (duration2 / 1000));
  const msPerOp2 = duration2 / entryCount;

  console.log(
    `✅ Iterated ${
      all.length
    } entries in ${duration2} ms (${opsPerSec2} ops/s, ${msPerOp2.toFixed(
      3
    )} ms/op)`
  );

  /** Cleanup */
  console.log("🧹 Cleaning up...");
  await db1.drop();
  await db1.close();
  await orbitdb.stop();
  await ipfs.stop();

  await rimraf("./ipfs");
  await rimraf("./orbitdb");

  console.log("🏁 Benchmark complete.");
  process.exit(0);
})();

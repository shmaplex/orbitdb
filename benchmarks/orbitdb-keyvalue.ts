import { createOrbitDB, OrbitDBInstance } from "../src";
import { rimraf as rmrf } from "rimraf";
import createHelia from "../test/utils/create-helia";

import { EventEmitter } from "node:events";
import type { IPFS } from "ipfs-core-types";
import type { KeyValueInstance } from "../src/databases/keyvalue";

/** Increase max listeners for high-throughput benchmark */
EventEmitter.defaultMaxListeners = 10000;

(async () => {
  console.log("Starting benchmark...");

  const entryCount = 1000;

  await rmrf("./ipfs");
  await rmrf("./orbitdb");

  /** Initialize Helia node (lightweight IPFS) */
  const ipfs = (await createHelia()) as unknown as IPFS<{}>;

  /** Initialize OrbitDB */
  const orbitdb: OrbitDBInstance = await createOrbitDB({ ipfs });

  console.log(`Set ${entryCount} keys/values`);

  /** Open keyvalue store */
  const db1 = (await orbitdb.open("benchmark-keyvalue", {
    type: "keyvalue",
  })) as KeyValueInstance;

  /** Benchmark setting key/value pairs */
  const startTime1 = Date.now();
  for (let i = 0; i < entryCount; i++) {
    await db1.put(i.toString(), "hello" + i);
  }
  const endTime1 = Date.now();
  const duration1 = endTime1 - startTime1;
  const operationsPerSecond1 = Math.floor(entryCount / (duration1 / 1000));
  const millisecondsPerOp1 = duration1 / entryCount;

  console.log(
    `Setting ${entryCount} key/values took ${duration1} ms, ${operationsPerSecond1} ops/s, ${millisecondsPerOp1} ms/op`
  );

  /** Benchmark iterating key/value pairs */
  console.log(`Iterate ${entryCount} key/values`);
  const startTime2 = Date.now();

  type KVEntry = { key: string; value: any; hash: string };
  const all: KVEntry[] = [];

  for await (const entry of db1.iterator()) {
    all.unshift(entry);
  }

  const endTime2 = Date.now();
  const duration2 = endTime2 - startTime2;
  const operationsPerSecond2 = Math.floor(entryCount / (duration2 / 1000));
  const millisecondsPerOp2 = duration2 / entryCount;

  console.log(
    `Iterating ${all.length} key/values took ${duration2} ms, ${operationsPerSecond2} ops/s, ${millisecondsPerOp2} ms/op`
  );

  /** Cleanup */
  await db1.drop();
  await db1.close();
  await orbitdb.stop();
  await ipfs.stop();

  await rmrf("./ipfs");
  await rmrf("./orbitdb");

  process.exit(0);
})();

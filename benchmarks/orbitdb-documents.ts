import { createOrbitDB, OrbitDBInstance } from "../src/index";
import { rimraf as rmrf } from "rimraf";
import createHelia from "../test/utils/create-helia";

import { EventEmitter } from "node:events";
import type { IPFS } from "ipfs-core-types";
import type { DocumentsInstance } from "../src/databases";

/** Increase max listeners for high-throughput benchmark */
EventEmitter.defaultMaxListeners = 10000;

/**
 * Benchmark for OrbitDB document insertion and querying
 */
(async () => {
  console.log("Starting benchmark...");

  const entryCount = 1000;

  await rmrf("./ipfs");
  await rmrf("./orbitdb");

  /** Initialize Helia node (lightweight IPFS) */
  const ipfs = (await createHelia()) as unknown as IPFS<{}>;

  /** Initialize OrbitDB */
  const orbitdb: OrbitDBInstance = await createOrbitDB({ ipfs });

  console.log(`Insert ${entryCount} documents`);

  /** Open document store */
  const db1 = (await orbitdb.open("benchmark-documents", {
    type: "documents",
  })) as DocumentsInstance;

  /** Benchmark inserting documents */
  const startTime1 = Date.now();
  for (let i = 0; i < entryCount; i++) {
    const doc = { _id: i.toString(), message: `hello ${i}` };
    await db1.put(doc);
  }
  const endTime1 = Date.now();
  const duration1 = endTime1 - startTime1;
  const operationsPerSecond1 = Math.floor(entryCount / (duration1 / 1000));
  const millisecondsPerOp1 = duration1 / entryCount;

  console.log(
    `Inserting ${entryCount} documents took ${duration1} ms, ${operationsPerSecond1} ops/s, ${millisecondsPerOp1} ms/op`
  );

  /** Benchmark querying documents */
  console.log(`Query ${entryCount} documents`);
  const startTime2 = Date.now();

  type DBEntry = { key: string; value: unknown };
  const all: DBEntry[] = [];

  for await (const { key, value } of db1.iterator()) {
    all.unshift({ key, value });
  }

  const endTime2 = Date.now();
  const duration2 = endTime2 - startTime2;
  const operationsPerSecond2 = Math.floor(entryCount / (duration2 / 1000));
  const millisecondsPerOp2 = duration2 / entryCount;

  console.log(
    `Querying ${all.length} documents took ${duration2} ms, ${operationsPerSecond2} ops/s, ${millisecondsPerOp2} ms/op`
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

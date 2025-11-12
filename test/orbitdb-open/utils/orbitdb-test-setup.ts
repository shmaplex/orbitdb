// test/orbitdb-open/utils/orbitdb-test-setup.ts
import { rimraf } from "rimraf";
import createHelia from "../../utils/create-helia";
import { createOrbitDB } from "../../../src";
import connectPeers from "../../utils/connect-nodes";

export async function setupTwoNodes() {
  const ipfs1 = await createHelia();
  const ipfs2 = await createHelia();
  await connectPeers(ipfs1, ipfs2);
  return { ipfs1, ipfs2 };
}

export async function teardownTwoNodes(
  ipfs1: any,
  ipfs2: any,
  paths: string[] = []
) {
  if (ipfs1) await ipfs1.stop();
  if (ipfs2) await ipfs2.stop();
  for (const p of paths) {
    await rimraf(p);
  }
}

export async function createDB(ipfs: any, id: string, directory?: string) {
  return await createOrbitDB({ ipfs, id, directory });
}

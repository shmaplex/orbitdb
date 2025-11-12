// test/sync/helpers.ts
import { Log, Identities, KeyStore } from "../../src";
import { rimraf } from "rimraf";
import { copy } from "fs-extra";
import testKeysPath from "../fixtures/test-keys-path";
import createHelia from "../utils/create-helia";

export const keysPath = "./testkeys";

export const setupIdentities = async () => {
  const ipfs1 = await createHelia();
  const ipfs2 = await createHelia();
  const keystore = await KeyStore({ path: keysPath });
  const identities = await Identities({ keystore });
  const testIdentity1 = await identities.createIdentity({ id: "userA" });
  const testIdentity2 = await identities.createIdentity({ id: "userB" });

  return { ipfs1, ipfs2, keystore, identities, testIdentity1, testIdentity2 };
};

export const cleanup = async (ipfsList: any[], keystore?: any) => {
  for (const ipfs of ipfsList) {
    if (ipfs) await ipfs.stop();
  }
  if (keystore) await keystore.close();
  await rimraf("./ipfs1");
  await rimraf("./ipfs2");
  await rimraf(keysPath);
};

export const copyKeys = async () => {
  await copy(testKeysPath, keysPath);
};

export const createLog = async (
  identity: any,
  logId?: string,
  entryStorage?: any
) => {
  return await Log(identity, { logId, entryStorage });
};

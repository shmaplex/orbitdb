// test/oplog/utils/test-setup.ts
import { copy } from "fs-extra";
import { rimraf } from "rimraf";
import { Identities, KeyStore } from "../../../src/index.js";
import testKeysPath from "../../fixtures/test-keys-path.js";

export const keysPath = "./testkeys";

export async function setupIdentities() {
  await copy(testKeysPath, keysPath);
  const keystore = await KeyStore({ path: keysPath });
  const identities = [
    await Identities({ keystore }),
    await Identities({ keystore }),
    await Identities({ keystore }),
    await Identities({ keystore }),
  ];
  const testIdentities = await Promise.all([
    identities[0].createIdentity({ id: "userX" }),
    identities[1].createIdentity({ id: "userB" }),
    identities[2].createIdentity({ id: "userC" }),
    identities[3].createIdentity({ id: "userA" }),
  ]);
  return { keystore, identities, testIdentities };
}

export async function cleanup(keystore?: any) {
  if (keystore) await keystore.close();
  await rimraf(keysPath);
}

// Fixed generic function
export function last<T>(arr: T[]): T {
  return arr[arr.length - 1];
}

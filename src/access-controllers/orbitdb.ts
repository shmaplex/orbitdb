// src/access-controllers/orbitdb.ts
import type { LogEntry } from "../oplog/log";
import { createId } from "../utils";
import IPFSAccessController from "./ipfs";

const type = "orbitdb";

export interface OrbitDBAccessControllerContext {
  orbitdb: {
    identity: { id: string };
    open: (
      address: string,
      options: { type: string; AccessController: any }
    ) => Promise<any>;
  };
  identities: {
    getIdentity: (id: string) => Promise<{ id: string } | undefined>;
    verifyIdentity: (identity: { id: string }) => Promise<boolean>;
  };
  address?: string;
  name?: string;
  write?: string[];
}

const OrbitDBAccessController: typeof IPFSAccessController = Object.assign(
  async ({
    orbitdb,
    identities,
    address,
    name,
    write,
  }: OrbitDBAccessControllerContext) => {
    address = address || name || (await createId(64));
    write = write || [orbitdb.identity.id];

    const db = await orbitdb.open(address, {
      type: "keyvalue",
      AccessController: IPFSAccessController({ write }),
    });

    const capabilities = async (): Promise<Record<string, Set<string>>> => {
      const caps: Record<string, Set<string>> = {};
      for await (const entry of db.iterator()) {
        caps[entry.key] = new Set(entry.value || []);
      }

      Object.entries({
        ...caps,
        admin: new Set([...(caps.admin || []), ...db.access.write]),
      }).forEach(([k, v]) => {
        caps[k] = v;
      });

      return caps;
    };

    const get = async (capability: string): Promise<Set<string>> =>
      (await capabilities())[capability] || new Set();

    const hasCapability = async (
      capability: string,
      key: string
    ): Promise<boolean> =>
      (await get(capability)).has(key) || (await get(capability)).has("*");

    const canAppend = async (entry: LogEntry): Promise<boolean> => {
      const writer = await identities.getIdentity(entry.identity);
      if (!writer) return false;
      const hasWriteAccess =
        (await hasCapability("write", writer.id)) ||
        (await hasCapability("admin", writer.id));
      return hasWriteAccess ? await identities.verifyIdentity(writer) : false;
    };

    const grant = async (cap: string, key: string) => {
      const current = new Set([...((await db.get(cap)) || []), key]);
      await db.put(cap, Array.from(current));
    };

    const revoke = async (cap: string, key: string) => {
      const current = new Set((await db.get(cap)) || []);
      current.delete(key);
      if (current.size > 0) {
        await db.put(cap, Array.from(current));
      } else {
        await db.del(cap);
      }
    };

    const close = async () => db.close();
    const drop = async () => db.drop();

    return {
      type,
      address,
      write,
      canAppend,
      capabilities,
      get,
      hasCapability,
      grant,
      revoke,
      close,
      drop,
      events: db.events,
    };
  },
  { type }
);

export default OrbitDBAccessController;

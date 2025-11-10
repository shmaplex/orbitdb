/**
 * @namespace AccessControllers-OrbitDB
 * @memberof module:AccessControllers
 * @description
 * OrbitDB-based Access Controller. Uses an internal key-value store
 * to manage capabilities like write/admin access and integrates with
 * IPFSAccessController for identity verification.
 */

import type { IdentitiesInstance } from "../identities";
import type { LogEntry } from "../oplog/log";
import { createId } from "../utils";
import type {
  AccessControllerFactory,
  AccessControllerInstance,
  AccessControllerModule,
  AccessControllerParams,
} from ".";
import IPFSAccessController from "./ipfs";

const type = "orbitdb";

/**
 * Context provided to the inner function of the OrbitDB controller.
 * Narrow identity interface like the JS version.
 */
export interface OrbitDBAccessControllerContext {
  orbitdb: {
    identity: { id: string };
    open: (
      address: string,
      options: {
        type: string;
        AccessController: ReturnType<AccessControllerFactory>;
      }
    ) => Promise<any>;
  };
  identities: IdentitiesInstance;
  address?: string;
  name?: string;
}

/**
 * Optional parameters passed to the outer factory.
 */
export interface OrbitDBAccessControllerParams extends AccessControllerParams {
  write?: string[];
}

/**
 * Extended instance type to include JS helper methods.
 */
export interface OrbitDBAccessControllerInstance
  extends AccessControllerInstance {
  get?: (cap: string) => Promise<Set<string>>;
  hasCapability?: (cap: string, key: string) => Promise<boolean>;
  grant?: (cap: string, key: string) => Promise<void>;
  revoke?: (cap: string, key: string) => Promise<void>;
  events?: any;
}

/**
 * OrbitDBAccessController — fully typed curried factory
 */
const OrbitDBAccessController: AccessControllerModule = Object.assign(
  ({ write }: OrbitDBAccessControllerParams = {}) =>
    async ({
      orbitdb,
      identities,
      address,
      name,
    }: OrbitDBAccessControllerContext): Promise<OrbitDBAccessControllerInstance> => {
      // Generate or default address
      address = address || name || (await createId(64));
      write = write || [orbitdb.identity.id];

      // Open database for access control
      const db = await orbitdb.open(address, {
        type: "keyvalue",
        AccessController: IPFSAccessController({ write }),
      });
      address = db.address;

      const capabilities = async (): Promise<Record<string, Set<string>>> => {
        const _capabilities: Record<string, Set<string>> = {};
        for await (const entry of db.iterator()) {
          _capabilities[entry.key] = new Set(entry.value || []);
        }
        _capabilities.admin = new Set([
          ...(_capabilities.admin || []),
          ...(db.access?.write || []),
        ]);
        return _capabilities;
      };

      const get = async (cap: string): Promise<Set<string>> => {
        const _capabilities = await capabilities();
        return _capabilities[cap] || new Set();
      };

      const hasCapability = async (
        cap: string,
        key: string
      ): Promise<boolean> => {
        const access = await get(cap);
        return access.has(key) || access.has("*");
      };

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
        db.events.emit("update");
      };

      const revoke = async (cap: string, key: string) => {
        const current = new Set((await db.get(cap)) || []);
        current.delete(key);
        if (current.size > 0) {
          await db.put(cap, Array.from(current));
        } else {
          await db.del(cap);
        }
        db.events.emit("update");
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

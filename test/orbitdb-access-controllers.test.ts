import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { rimraf } from "rimraf";
import OrbitDB from "../src/orbitdb.js";
import {
  IPFSAccessController,
  OrbitDBAccessController,
  useAccessController,
  getAccessController,
} from "../src/access-controllers/index.js";
import pathJoin from "../src/utils/path-join.js";
import createHelia from "./utils/create-helia.js";

/**
 * @file Custom Access Controller Test Suite
 * @description Tests for adding and using custom access controllers in OrbitDB
 */

const type = "custom!";

/**
 * A simple custom access controller
 */
const CustomAccessController =
  () =>
  async ({ orbitdb, identities, address }) => {
    address = pathJoin("/", type, "controller");
    return { address };
  };

CustomAccessController.type = type;

describe("Add a custom access controller", () => {
  let ipfs: any;
  let orbitdb: any;

  beforeAll(async () => {
    ipfs = await createHelia();
    orbitdb = await OrbitDB({ ipfs });
  });

  afterAll(async () => {
    if (orbitdb) await orbitdb.stop();
    if (ipfs) await ipfs.stop();
    await rimraf("./orbitdb");
    await rimraf("./ipfs1");
  });

  describe("Default supported access controllers", () => {
    it("returns default supported access controllers", async () => {
      expect(getAccessController("ipfs")).toEqual(IPFSAccessController);
      expect(getAccessController("orbitdb")).toEqual(OrbitDBAccessController);
    });

    it("throws an error if custom access controller hasn't been added", async () => {
      let err: any;
      try {
        const db = await orbitdb.open("hello", {
          AccessController: CustomAccessController(),
        });
        await db.close();
        await orbitdb.open(db.address);
      } catch (e: any) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.message).toBe(
        "AccessController type 'custom!' is not supported"
      );
    });
  });

  describe("Custom access controller", () => {
    beforeEach(() => {
      useAccessController(CustomAccessController);
    });

    it("creates a database with the custom access controller", async () => {
      const name = "hello custom AC";
      const db = await orbitdb.open(name, {
        AccessController: CustomAccessController(),
      });
      expect(db.access.address).toBe("/custom!/controller");
    });

    it("throws an error if custom access controller has no type", async () => {
      const NoTypeCustomAccessController = () => async () => {};

      let err: any;
      try {
        useAccessController(NoTypeCustomAccessController);
      } catch (e: any) {
        err = e.toString();
      }

      expect(err).toBe(
        "Error: AccessController does not contain required field 'type'."
      );
    });

    it("returns custom access controller after adding it", async () => {
      expect(getAccessController(type)).toEqual(CustomAccessController);
    });
  });
});

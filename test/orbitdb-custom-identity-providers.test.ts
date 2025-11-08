import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { rimraf } from "rimraf";
import {
  createOrbitDB,
  Identities,
  useIdentityProvider,
} from "../src/index.js";
import CustomIdentityProvider from "./fixtures/providers/custom.js";
import createHelia from "./utils/create-helia.js";

/**
 * @file Custom Identity Provider Test Suite
 * @description Tests for adding and using a custom identity provider in OrbitDB
 */

describe("Add a custom identity provider", () => {
  let ipfs: any;

  beforeAll(async () => {
    ipfs = await createHelia();
  });

  afterAll(async () => {
    if (ipfs) await ipfs.stop();
    await rimraf("./orbitdb");
    await rimraf("./ipfs1");
  });

  it("creates an identity using an id and default pubkey provider", async () => {
    useIdentityProvider(CustomIdentityProvider);
    const identities = await Identities();
    const identity = await identities.createIdentity({ id: "abc" });
    const orbitdb = await createOrbitDB({ ipfs, identities, id: "abc" });

    expect(orbitdb.identity).toEqual(identity);

    await orbitdb.stop();
  });

  it("creates an identity using a custom provider", async () => {
    useIdentityProvider(CustomIdentityProvider);
    const identities = await Identities();
    const identity = { provider: CustomIdentityProvider() };
    const expectedIdentity = await identities.createIdentity(identity);
    const orbitdb = await createOrbitDB({ ipfs, identities, identity });

    expect(orbitdb.identity).toEqual(expectedIdentity);

    await orbitdb.stop();
  });

  it("uses an existing identity created with a custom provider", async () => {
    useIdentityProvider(CustomIdentityProvider);
    const identities = await Identities();
    const identity = await identities.createIdentity({
      provider: CustomIdentityProvider(),
    });
    const orbitdb = await createOrbitDB({ ipfs, identities, identity });

    expect(orbitdb.identity).toEqual(identity);

    await orbitdb.stop();
  });
});

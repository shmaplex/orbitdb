import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
} from "vitest";
import { rimraf } from "rimraf";
import { copy } from "fs-extra";
import { toString as uint8ArrayToString } from "uint8arrays/to-string";
import KeyStore, { signMessage, verifyMessage } from "../../src/key-store";
import {
  Identities,
  useIdentityProvider,
  getIdentityProvider,
  Identity,
  PublicKeyIdentityProvider,
} from "../../src/identities";
import testKeysPath from "../fixtures/test-keys-path";
import CustomIdentityProvider from "../fixtures/providers/custom";
import FakeIdentityProvider from "../fixtures/providers/fake";
import NoTypeIdentityProvider from "../fixtures/providers/no-type";
import NoVerifyIdentityIdentityProvider from "../fixtures/providers/no-verify-identity";

const type = "publickey";
const keysPath = "./testkeys";

describe("Identities", () => {
  beforeAll(async () => {
    await copy(testKeysPath, keysPath);
  });

  afterAll(async () => {
    await rimraf(keysPath);
  });

  describe("Creating Identities", () => {
    const id = "userA";
    let identities: any;
    let identity: any;

    afterEach(async () => {
      if (identities) await identities.keystore.close();
    });

    it("has the correct id", async () => {
      identities = await Identities({ path: keysPath });
      identity = await identities.createIdentity({ id });
      const key = await identities.keystore.getKey(id);
      const externalId = uint8ArrayToString(key.publicKey.raw, "base16");
      expect(identity.id).toBe(externalId);
    });
  });

  describe("Get Identity", () => {
    const id = "userA";
    let identities: any;
    let identity: any;

    afterEach(async () => {
      if (identities) await identities.keystore.close();
    });

    it("gets the identity from storage", async () => {
      identities = await Identities({ path: keysPath });
      identity = await identities.createIdentity({ id });
      const result = await identities.getIdentity(identity.hash);
      expect(result.id).toBe(identity.id);
      expect(result.hash).toBe(identity.hash);
      expect(result.publicKey).toBe(identity.publicKey);
      expect(result.type).toBe(identity.type);
      expect(result.signatures).toEqual(identity.signatures);
      expect(result.sign).toBeUndefined();
      expect(result.verify).toBeUndefined();
    });

    it("passes in an identity provider", async () => {
      const keystore = await KeyStore({ path: keysPath });
      identities = await Identities({ keystore });
      const provider = PublicKeyIdentityProvider({ keystore });
      identity = await identities.createIdentity({ id, provider });
      const result = await identities.getIdentity(identity.hash);
      expect(result.id).toBe(identity.id);
      expect(result.hash).toBe(identity.hash);
      expect(result.publicKey).toBe(identity.publicKey);
      expect(result.type).toBe(identity.type);
      expect(result.signatures).toEqual(identity.signatures);
      expect(result.sign).toBeUndefined();
      expect(result.verify).toBeUndefined();
    });
  });

  describe("Passing in custom keystore", () => {
    const id = "userB";
    let identity: any;
    let identities: any;
    let keystore: any;

    beforeAll(async () => {
      keystore = await KeyStore({ path: keysPath });
      identities = await Identities({ keystore });
    });

    afterAll(async () => {
      if (keystore) await keystore.close();
    });

    it("has the correct id", async () => {
      identity = await identities.createIdentity({ id });
      keystore = identities.keystore;
      const key = await keystore.getKey(id);
      const externalId = uint8ArrayToString(key.publicKey.raw, "base16");
      expect(identity.id).toBe(externalId);
    });

    it("created a key for id in identity-keystore", async () => {
      const key = await keystore.getKey(id);
      expect(key).toBeDefined();
    });

    it("has the correct public key", async () => {
      const key = await keystore.getKey(id);
      const externalId = uint8ArrayToString(key.publicKey.raw, "base16");
      const signingKey = await keystore.getKey(externalId);
      expect(signingKey).toBeDefined();
      expect(identity.publicKey).toBe(keystore.getPublic(signingKey));
    });

    it("has a signature for the id", async () => {
      const key = await keystore.getKey(id);
      const externalId = uint8ArrayToString(key.publicKey.raw, "base16");
      const signingKey = await keystore.getKey(externalId);
      const idSignature = await signMessage(signingKey, externalId);
      const publicKey = uint8ArrayToString(signingKey.publicKey.raw, "base16");
      const verifies = await verifyMessage(idSignature, publicKey, externalId);
      expect(verifies).toBe(true);
      expect(identity.signatures.id).toBe(idSignature);
    });

    it("has a signature for the publicKey", async () => {
      const key = await keystore.getKey(id);
      const externalId = uint8ArrayToString(key.publicKey.raw, "base16");
      const signingKey = await keystore.getKey(externalId);
      const idSignature = await signMessage(signingKey, externalId);
      const externalKey = await keystore.getKey(id);
      const publicKeyAndIdSignature = await signMessage(
        externalKey,
        identity.publicKey + idSignature
      );
      expect(identity.signatures.publicKey).toBe(publicKeyAndIdSignature);
    });
  });

  describe("create an identity with saved keys", () => {
    const id = "userX";
    const expectedPublicKey =
      "0342fa42a69135eade1e37ea520bc8ee9e240efd62cb0edf0516b21258b4eae656";
    const expectedIdSignature =
      "3044022068b4bc360d127e39164fbc3b5184f5bd79cc5976286f793d9b38d1f2818e0259022027b875dc8c73635b32db72177b9922038ec4b1eabc8f1fd0919806b0b2519419";
    const expectedPkIdSignature =
      "30440220464cd4a6202dae2d2fb75b47afc7cceafa6b13c310efabbbdaaf38e67f74188b02201bbef8c97b741b4bb9e3e5362edfcd2eb6fe3b93f4e68e5870fcc345a850f366";

    let identities: any;
    let identity: any;
    let savedKeysKeyStore: any;

    beforeAll(async () => {
      savedKeysKeyStore = await KeyStore({ path: keysPath });
      identities = await Identities({ keystore: savedKeysKeyStore });
      identity = await identities.createIdentity({ id });
    });

    afterAll(async () => {
      if (savedKeysKeyStore) await savedKeysKeyStore.close();
    });

    it("has the correct id", async () => {
      const key = await savedKeysKeyStore.getKey(id);
      expect(identity.id).toBe(uint8ArrayToString(key.publicKey.raw, "base16"));
    });

    it("has the correct public key", () => {
      expect(identity.publicKey).toBe(expectedPublicKey);
    });

    it("has the correct identity type", () => {
      expect(identity.type).toBe(type);
    });

    it("has the correct idSignature", () => {
      expect(identity.signatures.id).toBe(expectedIdSignature);
    });

    it("has a publicKeyAndIdSignature for the publicKey", () => {
      expect(identity.signatures.publicKey).toBe(expectedPkIdSignature);
    });

    it("has the correct signatures", async () => {
      const internalSigningKey = await savedKeysKeyStore.getKey(identity.id);
      const externalSigningKey = await savedKeysKeyStore.getKey(id);
      const idSignature = await signMessage(internalSigningKey, identity.id);
      const publicKeyAndIdSignature = await signMessage(
        externalSigningKey,
        identity.publicKey + idSignature
      );
      const expectedSignature = {
        id: idSignature,
        publicKey: publicKeyAndIdSignature,
      };
      expect(identity.signatures).toEqual(expectedSignature);
    });
  });

  describe("verify identity's signature", () => {
    const id = "QmFoo";
    let identities: any;
    let identity: any;
    let keystore: any;

    beforeAll(async () => {
      keystore = await KeyStore({ path: keysPath });
    });

    afterAll(async () => {
      if (keystore) await keystore.close();
    });

    it("identity pkSignature verifies", async () => {
      identities = await Identities({ keystore });
      identity = await identities.createIdentity({ id });
      const verified = await verifyMessage(
        identity.signatures.id,
        identity.publicKey,
        identity.id
      );
      expect(verified).toBe(true);
    });

    it("identity signature verifies", async () => {
      identities = await Identities({ keystore });
      identity = await identities.createIdentity({ id });
      const verified = await verifyMessage(
        identity.signatures.publicKey,
        identity.id,
        identity.publicKey + identity.signatures.id
      );
      expect(verified).toBe(true);
    });

    it("false signature doesn't verify", async () => {
      useIdentityProvider(FakeIdentityProvider);
      identity = await identities.createIdentity({
        provider: FakeIdentityProvider(),
      });
      const verified = await identities.verifyIdentity(identity);
      expect(verified).toBe(false);
    });
  });

  describe("verify identity", () => {
    const id = "QmFoo";
    let identities: any;
    let identity: any;
    let keystore: any;

    beforeAll(async () => {
      keystore = await KeyStore({ path: keysPath });
      identities = await Identities({ keystore });
    });

    afterAll(async () => {
      if (keystore) await keystore.close();
    });

    it("identity verifies", async () => {
      identity = await identities.createIdentity({ id });
      const verified = await identities.verifyIdentity(identity);
      expect(verified).toBe(true);
    });
  });

  describe("sign data with an identity", () => {
    const id = "0x01234567890abcdefghijklmnopqrstuvwxyz";
    const data = "hello friend";

    let identities: any;
    let identity: any;
    let keystore: any;

    beforeAll(async () => {
      keystore = await KeyStore({ path: keysPath });
      identities = await Identities({ keystore });
      identity = await identities.createIdentity({ id });
    });

    afterAll(async () => {
      if (keystore) await keystore.close();
    });

    it("sign data", async () => {
      const signingKey = await keystore.getKey(identity.id);
      const expectedSignature = await signMessage(signingKey, data);
      const signature = await identities.sign(identity, data, keystore);
      expect(signature).toBe(expectedSignature);
    });

    it("throws an error if private key is not found from keystore", async () => {
      const { publicKey, signatures, type } = identity;

      // Cast to 'any' to ignore TS type checks
      const modifiedIdentity = await Identity({
        id: "this id does not exist",
        publicKey,
        signatures,
        type,
      } as any);

      let signature;
      let err;
      try {
        signature = await identities.sign(modifiedIdentity, data, keystore);
      } catch (e: any) {
        err = e.toString();
      }

      expect(signature).toBeUndefined();
      expect(err).toBe("Error: Private signing key not found from KeyStore");
    });
  });

  describe("verify data signed by an identity", () => {
    const id =
      "03602a3da3eb35f1148e8028f141ec415ef7f6d4103443edbfec2a0711d716f53f";
    const data = "hello friend";

    let identities: any;
    let identity: any;
    let keystore: any;
    let signature: any;

    beforeAll(async () => {
      keystore = await KeyStore({ path: keysPath });
    });

    afterAll(async () => {
      if (keystore) await keystore.close();
    });

    beforeEach(async () => {
      identities = await Identities({ keystore });
      identity = await identities.createIdentity({ id });
      signature = await identities.sign(identity, data, keystore);
    });

    it("verifies that the signature is valid", async () => {
      const verified = await identities.verify(
        signature,
        identity.publicKey,
        data
      );
      expect(verified).toBe(true);
    });

    it("doesn't verify invalid signature", async () => {
      const verified = await identities.verify(
        "invalid",
        identity.publicKey,
        data
      );
      expect(verified).toBe(false);
    });
  });

  describe("manage identity providers", () => {
    it("can add an identity provider", () => {
      useIdentityProvider(CustomIdentityProvider);
      expect(getIdentityProvider("custom")).toBe(CustomIdentityProvider);
    });

    it("cannot add an identity provider with missing type", () => {
      let err;
      try {
        // Cast to any to ignore TS type checking
        useIdentityProvider(NoTypeIdentityProvider as any);
      } catch (e: any) {
        err = e.toString();
      }
      expect(err).toBe(
        "Error: Given IdentityProvider doesn't have a field 'type'."
      );
    });

    it("cannot add an identity provider with missing verifyIdentity", async () => {
      let err;
      try {
        useIdentityProvider(NoVerifyIdentityIdentityProvider);
      } catch (e: any) {
        err = e.toString();
      }
      expect(err).toBe(
        "Error: Given IdentityProvider doesn't have a function 'verifyIdentity'."
      );
    });
  });
});

import { describe, it, beforeAll, beforeEach, expect } from "vitest";
import { Identity, isIdentity, isEqual } from "../../src/identities/index.js";
import { decodeIdentity } from "../../src/identities/identity.js";

describe("Identity", () => {
  const id = "0x01234567890abcdefghijklmnopqrstuvwxyz";
  const publicKey = { raw: "<pubkey>" };
  const signatures = {
    id: "signature for <id>",
    publicKey: "signature for <publicKey + idSignature>",
  };
  const type = "orbitdb";

  const expectedHash = "zdpuArx43BnXdDff5rjrGLYrxUomxNroc2uaocTgcWK76UfQT";
  const expectedBytes = Uint8Array.from([
    164, 98, 105, 100, 120, 39, 48, 120, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57,
    48, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111,
    112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 100, 116, 121, 112,
    101, 103, 111, 114, 98, 105, 116, 100, 98, 105, 112, 117, 98, 108, 105, 99,
    75, 101, 121, 104, 60, 112, 117, 98, 107, 101, 121, 62, 106, 115, 105, 103,
    110, 97, 116, 117, 114, 101, 115, 162, 98, 105, 100, 114, 115, 105, 103,
    110, 97, 116, 117, 114, 101, 32, 102, 111, 114, 32, 60, 105, 100, 62, 105,
    112, 117, 98, 108, 105, 99, 75, 101, 121, 120, 39, 115, 105, 103, 110, 97,
    116, 117, 114, 101, 32, 102, 111, 114, 32, 60, 112, 117, 98, 108, 105, 99,
    75, 101, 121, 32, 43, 32, 105, 100, 83, 105, 103, 110, 97, 116, 117, 114,
    101, 62,
  ]);

  let identity: any;

  beforeAll(async () => {
    identity = await Identity({ id, publicKey, signatures, type });
  });

  it("has the correct id", async () => {
    expect(identity.id).toBe(id);
  });

  it("has the correct publicKey", async () => {
    expect(identity.publicKey).toBe(publicKey);
  });

  it("has the correct idSignature", async () => {
    expect(identity.signatures.id).toBe(signatures.id);
  });

  it("has the correct publicKeyAndIdSignature", async () => {
    expect(identity.signatures.publicKey).toBe(signatures.publicKey);
  });

  describe("Constructor inputs", () => {
    it("throws an error if id was not given", async () => {
      await expect(Identity()).rejects.toThrow("Identity id is required");
    });

    it("throws an error if publicKey was not given", async () => {
      await expect(Identity({ id: "abc" })).rejects.toThrow(
        "Invalid public key"
      );
    });

    it("throws an error if signatures object was not given", async () => {
      await expect(Identity({ id: "abc", publicKey })).rejects.toThrow(
        "Signatures object is required"
      );
    });

    it("throws an error if signature for id was not given", async () => {
      await expect(
        Identity({ id: "abc", publicKey, signatures: {} })
      ).rejects.toThrow("Signature of id is required");
    });

    it("throws an error if signature for publicKey was not given", async () => {
      await expect(
        Identity({ id: "abc", publicKey, signatures: { id: signatures.id } })
      ).rejects.toThrow("Signature of publicKey+id is required");
    });

    it("throws an error if id signature missing but publicKey signature given", async () => {
      await expect(
        Identity({
          id: "abc",
          publicKey,
          signatures: { publicKey: signatures.publicKey },
        })
      ).rejects.toThrow("Signature of id is required");
    });

    it("throws an error if identity type was not given", async () => {
      await expect(
        Identity({ id: "abc", publicKey, signatures })
      ).rejects.toThrow("Identity type is required");
    });
  });

  describe("isIdentity", () => {
    it("valid identity is recognized", async () => {
      const iden = await Identity({ id, publicKey, signatures, type });
      expect(isIdentity(iden)).toBe(true);
    });

    it("invalid identity is detected", async () => {
      identity = await Identity({ id, publicKey, signatures, type });

      delete identity.id;
      expect(isIdentity(identity)).toBe(false);

      identity = await Identity({ id, publicKey, signatures, type });
      delete identity.hash;
      expect(isIdentity(identity)).toBe(false);

      identity = await Identity({ id, publicKey, signatures, type });
      delete identity.bytes;
      expect(isIdentity(identity)).toBe(false);

      identity = await Identity({ id, publicKey, signatures, type });
      delete identity.publicKey;
      expect(isIdentity(identity)).toBe(false);

      identity = await Identity({ id, publicKey, signatures, type });
      delete identity.signatures;
      expect(isIdentity(identity)).toBe(false);

      identity = await Identity({ id, publicKey, signatures, type });
      delete identity.signatures.id;
      expect(isIdentity(identity)).toBe(false);

      identity = await Identity({ id, publicKey, signatures, type });
      delete identity.signatures.publicKey;
      expect(isIdentity(identity)).toBe(false);

      identity = await Identity({ id, publicKey, signatures, type });
      delete identity.type;
      expect(isIdentity(identity)).toBe(false);
    });
  });

  describe("isEqual", () => {
    it("equal identities are equal", async () => {
      const identity1 = await Identity({ id, publicKey, signatures, type });
      const identity2 = await Identity({ id, publicKey, signatures, type });
      expect(isEqual(identity1, identity2)).toBe(true);
    });

    it("non-equal identities are detected", async () => {
      const identity1 = await Identity({ id, publicKey, signatures, type });

      let identity2 = await Identity({ id: "X", publicKey, signatures, type });
      expect(isEqual(identity1, identity2)).toBe(false);

      identity2 = await Identity({ id, publicKey, signatures, type });
      identity2.hash = "notthesame";
      expect(isEqual(identity1, identity2)).toBe(false);

      identity2 = await Identity({ id, publicKey, signatures, type });
      identity2.type = "some other identity provider than orbitdb";
      expect(isEqual(identity1, identity2)).toBe(false);

      identity2 = await Identity({ id, publicKey: "XYZ", signatures, type });
      expect(isEqual(identity1, identity2)).toBe(false);

      identity2 = await Identity({
        id,
        publicKey,
        signatures: {
          id: "different id signature",
          publicKey: signatures.publicKey,
        },
        type,
      });
      expect(isEqual(identity1, identity2)).toBe(false);

      identity2 = await Identity({
        id,
        publicKey,
        signatures: {
          id: signatures.id,
          publicKey: "different publicKey signature",
        },
        type,
      });
      expect(isEqual(identity1, identity2)).toBe(false);
    });
  });

  describe("Decode Identity", () => {
    beforeAll(async () => {
      identity = await Identity({ id, publicKey, signatures, type });
    });

    it("decodes from bytes correctly", async () => {
      const result = await decodeIdentity(expectedBytes);
      expect(isIdentity(result)).toBe(true);
      expect(result.id).toBe(id);
      expect(result.publicKey).toBe(publicKey);
      expect(result.type).toBe(type);
      expect(result.hash).toBe(expectedHash);
      expect(result.sign).toBeUndefined();
      expect(result.verify).toBeUndefined();
      expect(result.bytes).toEqual(expectedBytes);
      expect(result.signatures).toEqual(signatures);
    });
  });
});

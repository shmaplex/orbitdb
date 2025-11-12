import { describe, it, expect, beforeAll } from "vitest";
import OrbitDBAddress, { isValidAddress, parseAddress } from "../src/address";

/**
 * @file OrbitDBAddress Test Suite
 * @description Tests for creating, validating, and parsing OrbitDB addresses.
 */
describe("Address", () => {
  describe("Creating an address from full address string", () => {
    const addressStr =
      "/orbitdb/zdpuAuK3BHpS7NvMBivynypqciYCuy2UW77XYBPUYRnLjnw13";

    it("creates an address from full address string", () => {
      const addr = OrbitDBAddress(addressStr);
      expect(addr).toBeDefined();
    });

    it("has a protocol prefix", () => {
      const addr = OrbitDBAddress(addressStr);
      expect(addr.protocol).toBe("orbitdb");
    });

    it("has a path", () => {
      const addr = OrbitDBAddress(addressStr);
      expect(addr.hash).toBe(
        "zdpuAuK3BHpS7NvMBivynypqciYCuy2UW77XYBPUYRnLjnw13"
      );
    });
  });

  describe("Creating an address from hash string", () => {
    const hashStr = "zdpuAuK3BHpS7NvMBivynypqciYCuy2UW77XYBPUYRnLjnw13";

    it("creates an address", () => {
      const addr = OrbitDBAddress(hashStr);
      expect(addr).toBeDefined();
    });

    it("has a protocol prefix", () => {
      const addr = OrbitDBAddress(hashStr);
      expect(addr.protocol).toBe("orbitdb");
    });

    it("has a path", () => {
      const addr = OrbitDBAddress(hashStr);
      expect(addr.hash).toBe(hashStr);
    });
  });

  describe("Creating an address from another address", () => {
    const hashStr = "zdpuAuK3BHpS7NvMBivynypqciYCuy2UW77XYBPUYRnLjnw13";
    let addr1: any, addr2: any;

    beforeAll(() => {
      addr1 = OrbitDBAddress(hashStr);
      addr2 = OrbitDBAddress(addr1);
    });

    it("creates an address", () => {
      expect(addr1).toEqual(addr2);
    });

    it("has a protocol prefix", () => {
      expect(addr2.protocol).toBe("orbitdb");
    });

    it("has a path", () => {
      expect(addr2.hash).toBe(hashStr);
    });
  });

  describe("Converting address to a string", () => {
    it("outputs a valid address string", () => {
      const addressStr =
        "/orbitdb/zdpuAuK3BHpS7NvMBivynypqciYCuy2UW77XYBPUYRnLjnw13";
      const addr = OrbitDBAddress(addressStr);
      expect(addr.toString()).toBe(addressStr);
    });
  });

  describe("isValid Address", () => {
    it("is not valid if address is an empty string", () => {
      expect(isValidAddress("")).toBe(false);
    });

    it("is a valid address", () => {
      const addressStr =
        "/orbitdb/zdpuAuK3BHpS7NvMBivynypqciYCuy2UW77XYBPUYRnLjnw13";
      expect(isValidAddress(addressStr)).toBe(true);
    });

    it("is valid if it's another OrbitDBAddress instance", () => {
      const addressStr =
        "/orbitdb/zdpuAuK3BHpS7NvMBivynypqciYCuy2UW77XYBPUYRnLjnw13";
      const addr = OrbitDBAddress(addressStr);
      expect(isValidAddress(addr)).toBe(true);
    });

    it("is not valid if missing /orbitdb prefix", () => {
      const addressStr = "zdpuAuK3BHpS7NvMBivynypqciYCuy2UW77XYBPUYRnLjnw13";
      expect(isValidAddress(addressStr)).toBe(false);
    });

    it("is not valid if multihash is invalid - v0", () => {
      const addressStr =
        "/orbitdb/Qmdgwt7w4uBsw8LXduzCd18zfGXeTmBsiR8edQ1hSfzc";
      expect(isValidAddress(addressStr)).toBe(false);
    });

    it("is not valid if multihash is invalid - v2", () => {
      const addressStr =
        "/orbitdb/zdpuAuK3BHpS7NvMBivynypqciYCuy2UW77XYBPUYRnLjnw133333";
      expect(isValidAddress(addressStr)).toBe(false);
    });

    it("is a valid address in win32 format", () => {
      const addressStr =
        "\\orbitdb\\Qmdgwt7w4uBsw8LXduzCd18zfGXeTmBsiR8edQ1hSfzcJC";
      expect(isValidAddress(addressStr)).toBe(true);
    });
  });

  describe("Parsing an address", () => {
    it("parses a valid address", () => {
      const addressStr =
        "/orbitdb/zdpuAuK3BHpS7NvMBivynypqciYCuy2UW77XYBPUYRnLjnw13";
      const result = parseAddress(addressStr);

      expect(result.protocol).toBe("orbitdb");
      expect(result.hash).toBe(
        "zdpuAuK3BHpS7NvMBivynypqciYCuy2UW77XYBPUYRnLjnw13"
      );
      expect(result.toString().startsWith("/orbitdb")).toBe(true);
      expect(
        result
          .toString()
          .includes("zdpuAuK3BHpS7NvMBivynypqciYCuy2UW77XYBPUYRnLjnw13")
      ).toBe(true);
    });

    it("parses a valid address in win32 format", () => {
      const addressStr =
        "\\orbitdb\\Qmdgwt7w4uBsw8LXduzCd18zfGXeTmBsiR8edQ1hSfzcJC";
      const result = parseAddress(addressStr);

      expect(result.protocol).toBe("orbitdb");
      expect(result.hash).toBe(
        "Qmdgwt7w4uBsw8LXduzCd18zfGXeTmBsiR8edQ1hSfzcJC"
      );
      expect(result.toString().startsWith("/orbitdb")).toBe(true);
      expect(
        result
          .toString()
          .includes("Qmdgwt7w4uBsw8LXduzCd18zfGXeTmBsiR8edQ1hSfzcJC")
      ).toBe(true);
    });

    it("throws an error if address is empty", () => {
      expect(() => parseAddress("")).toThrow("Not a valid OrbitDB address: ");
    });

    it("throws an error if address contains too many parts", () => {
      const addressStr =
        "/orbitdb/Qmdgwt7w4uBsw8LXduzCd18zfGXeTmBsiR8edQ1hSfzc/this-should-not-be-here";
      expect(() => parseAddress(addressStr)).toThrow(
        `Not a valid OrbitDB address: ${addressStr}`
      );
    });
  });
});

import { describe, it, expect } from "vitest";

/**
 * @file Loader Check Test
 * @description Ensures that the loader correctly handles TypeScript files.
 */

describe("Loader Check", () => {
  /**
   * Simple test to verify that TypeScript files are loaded and values are correctly assigned.
   */
  it("should load TypeScript files", () => {
    const value: string = "test";

    // Assert that the value is exactly what we expect
    expect(value).toBe("test");
  });
});

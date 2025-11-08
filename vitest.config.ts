import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.spec.ts"],
    exclude: ["test/browser/**", "test/utils/relay.ts", "test/fixtures/**"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Type checking
    typecheck: {
      enabled: true,
      tsconfig: "./test/tsconfig.json",
    },
    // Coverage
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["test/**", "conf/**", "docs/**"],
    },
  },
});

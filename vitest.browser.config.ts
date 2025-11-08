import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    globals: true,
    browser: {
      enabled: true,
      provider: playwright({}),
    },
    include: ["test/browser/**/*.test.ts"],
    testTimeout: 30000,
  },
});

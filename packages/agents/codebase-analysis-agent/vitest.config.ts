import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "modules/**/*.cache.test.ts"],
    isolate: true,
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // happy-dom provides Web Crypto (crypto.subtle), URL, etc. used by workspace-id.ts
    environment: "happy-dom",
    include: ["ui/**/*.test.ts", "ui/**/*.test.tsx"],
  },
});

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Unit tests use in-memory mock repos; never load SQL from .env.local
    env: {
      REPOSITORY_DRIVER: "mock",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./tests/mocks/server-only.ts"),
      "client-only": path.resolve(__dirname, "./tests/mocks/client-only.ts"),
    },
  },
});

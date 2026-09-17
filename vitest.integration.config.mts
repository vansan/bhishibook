import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Integration tests run against a REAL PostgreSQL database.
 *
 * They are kept in their own config so `npm test` stays fast and
 * dependency-free, while `npm run test:integration` exercises the service
 * layer end to end: transactions, constraints, receipt numbering and tenant
 * scoping cannot be proven with mocks.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Must come first: "@/..." would otherwise swallow this.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.itest.ts"],
    // A separate database, so running tests can never touch real group money.
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://postgres:postgres@localhost:5432/bhishibook_test?schema=public",
      NODE_ENV: "test",
    },
    // Each file gets its own process, but they share one database, so they
    // must not run at the same time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

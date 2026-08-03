import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      // server.ts is the network entry point and types.ts is type-only, so
      // neither can be meaningfully covered. auth.ts and the repositories are
      // NOT excluded: they need integration tests against a real database.
      exclude: ["src/server.ts", "src/openapi/write.ts", "src/types.ts"],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 70 },
    },
  },
});

import { defineConfig } from "vitest/config";
import path from "path";
export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 15000,
    // Export tests that call renderToBuffer (PDF) use a longer per-test timeout
    // set inline with { timeout: 60000 } on each PDF test.
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});

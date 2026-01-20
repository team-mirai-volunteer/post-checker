import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: [
      "scripts/test/unit/**/*.test.ts",
      "scripts/test/integration/**/*.test.ts",
    ],
    setupFiles: ["dotenv/config"],
  },
});

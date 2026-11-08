import { defineConfig } from "@playwright/test";

const origin = "http://127.0.0.1:3456";

export default defineConfig({
  testDir: "./tests",
  testMatch: "instagram-follow-checker.spec.ts",
  use: { baseURL: origin, serviceWorkers: "block" },
  webServer: {
    command: "node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3456",
    url: origin,
  },
});

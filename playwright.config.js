import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "browser.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "python3 -m http.server 8000",
    cwd: process.env.SITE_DIRECTORY || ".",
    url: "http://127.0.0.1:8000",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});

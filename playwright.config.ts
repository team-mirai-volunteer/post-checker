import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const baseURL = process.env.DIFY_CONSOLE_URL || "http://localhost";

export default defineConfig({
	testDir: "./scripts/test/e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: "html",
	use: {
		baseURL,
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	timeout: 30000,
});

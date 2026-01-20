import { expect, test } from "@playwright/test";

test.describe("Dify Health Check", () => {
  test("should return 200 for signin page", async ({ page }) => {
    const response = await page.goto("/signin");
    expect(response?.status()).toBe(200);
  });
});

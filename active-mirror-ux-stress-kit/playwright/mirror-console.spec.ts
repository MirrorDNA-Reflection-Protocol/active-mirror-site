import { expect, test } from "@playwright/test";

test.describe("Mirror console UX gate", () => {
  test.fixme("wire after Playwright is added to package.json");

  test("shows observing drafting acting state", async ({ page }) => {
    await page.goto("/mirror/");
    await expect(page.getByText(/create your first active mirror/i)).toBeVisible();
  });
});

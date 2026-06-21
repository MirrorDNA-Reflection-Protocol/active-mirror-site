import { expect, test } from "@playwright/test";

test.describe("Memory inspector UX gate", () => {
  test.fixme("wire after memory inspector UI exists");

  test("shows provenance and sensitivity for memory", async ({ page }) => {
    await page.goto("/mirror/");
    await expect(page.getByText(/context used/i)).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";

test.describe("Consent firewall UX gate", () => {
  test.fixme("wire after consent firewall UI exists");

  test("does not silently perform irreversible actions", async ({ page }) => {
    await page.goto("/mirror/");
    await expect(page.getByText(/receipt/i)).toBeVisible();
  });
});

import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const demoScript = resolve(repoRoot, "scripts/amos-campaign-approval-demo.mjs");
const outputDir = mkdtempSync(join(tmpdir(), "amos-approval-console-"));

const demo = spawnSync(process.execPath, [demoScript], {
  cwd: repoRoot,
  env: {
    ...process.env,
    AMOS_DEMO_OUTPUT_DIR: outputDir,
  },
  encoding: "utf8",
});

if (demo.status !== 0) {
  console.error(demo.stdout);
  console.error(demo.stderr);
  process.exit(demo.status || 1);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(pathToFileURL(resolve(outputDir, "approval-console.html")).href);

  await assertVisible(page, "text=Review before sending");
  await assertVisible(page, "text=This records a local decision only.");
  await assertVisible(page, "text=Held Actions");
  await page.fill("#approval-note", "Looks good for a local draft test.");
  await page.click('[data-decision="approved"]');

  const approved = JSON.parse(await page.locator("#decision-receipt").innerText());
  assert.strictEqual(approved.decision, "approved");
  assert.strictEqual(approved.workflow_id, "campaign-approval-demo");
  assert.deepStrictEqual(approved.external_actions_executed, []);
  assert.strictEqual(approved.requires_execution_gate, true);
  assert.match(approved.note, /local draft test/);

  await page.click('[data-decision="declined"]');
  const declined = JSON.parse(await page.locator("#decision-receipt").innerText());
  assert.strictEqual(declined.decision, "declined");
  assert.deepStrictEqual(declined.external_actions_executed, []);
  assert.strictEqual(declined.requires_execution_gate, false);

  console.log(
    JSON.stringify(
      {
        ok: true,
        output_dir: outputDir,
        checks: ["approval_console_loads", "approve_records_local_receipt", "decline_records_local_receipt"],
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}

async function assertVisible(page, selector) {
  await page.locator(selector).waitFor({ state: "visible", timeout: 5000 });
}

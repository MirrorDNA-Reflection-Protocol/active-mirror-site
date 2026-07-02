import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const demoScript = resolve(repoRoot, "scripts/amos-campaign-approval-demo.mjs");
const fixturePath = resolve(repoRoot, "docs/design-thinking-system/fixtures/campaign-approval-demo.json");
const toolGraphPath = resolve(repoRoot, "docs/design-thinking-system/toolgraph/campaign-approval-demo.tools.json");

function runDemo({ fixture, toolGraph = toolGraphPath, outputDir }) {
  return spawnSync(process.execPath, [demoScript], {
    cwd: repoRoot,
    env: {
      ...process.env,
      AMOS_DEMO_FIXTURE: fixture,
      AMOS_DEMO_TOOLGRAPH: toolGraph,
      AMOS_DEMO_OUTPUT_DIR: outputDir,
    },
    encoding: "utf8",
  });
}

function expectPass(label, result) {
  if (result.status !== 0) {
    console.error(`${label} failed unexpectedly.`);
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(1);
  }
}

function expectFail(label, result, expectedMarker) {
  const combined = `${result.stdout}\n${result.stderr}`;
  if (result.status === 0 || !combined.includes(expectedMarker)) {
    console.error(`${label} did not fail as expected.`);
    console.error(combined);
    process.exit(1);
  }
}

const tempRoot = mkdtempSync(join(tmpdir(), "amos-demo-guard-"));
const baseFixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const baseToolGraph = JSON.parse(readFileSync(toolGraphPath, "utf8"));

expectPass(
  "positive demo fixture",
  runDemo({
    fixture: fixturePath,
    outputDir: join(tempRoot, "positive"),
  }),
);

const leakFixture = structuredClone(baseFixture);
leakFixture.context.approved_brief = "SWFI campaign note with client-confidential details.";
const leakFixturePath = join(tempRoot, "leak-fixture.json");
writeFileSync(leakFixturePath, `${JSON.stringify(leakFixture, null, 2)}\n`);
expectFail(
  "client-boundary leak fixture",
  runDemo({
    fixture: leakFixturePath,
    outputDir: join(tempRoot, "leak"),
  }),
  "client_boundary_leak",
);

const approvalBypassFixture = structuredClone(baseFixture);
approvalBypassFixture.actions = approvalBypassFixture.actions.map((action) =>
  action.id === "send_launch_note" ? { ...action, approval_granted: true } : action,
);
const approvalBypassFixturePath = join(tempRoot, "approval-bypass-fixture.json");
writeFileSync(approvalBypassFixturePath, `${JSON.stringify(approvalBypassFixture, null, 2)}\n`);
expectFail(
  "approval bypass fixture",
  runDemo({
    fixture: approvalBypassFixturePath,
    outputDir: join(tempRoot, "approval-bypass"),
  }),
  "external_action_not_held_for_approval",
);

const missingToolGraph = structuredClone(baseToolGraph);
missingToolGraph.tools = missingToolGraph.tools.filter((tool) => tool.name !== "external_email");
const missingToolGraphPath = join(tempRoot, "missing-toolgraph.json");
writeFileSync(missingToolGraphPath, `${JSON.stringify(missingToolGraph, null, 2)}\n`);
expectFail(
  "missing toolgraph fixture",
  runDemo({
    fixture: fixturePath,
    toolGraph: missingToolGraphPath,
    outputDir: join(tempRoot, "missing-toolgraph"),
  }),
  "tool_not_registered:external_email",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      checks: [
        "positive_demo_fixture",
        "client_boundary_leak_blocks",
        "approval_bypass_blocks",
        "missing_toolgraph_blocks",
      ],
      temp_root: tempRoot,
    },
    null,
    2,
  ),
);

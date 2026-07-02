import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const demoScript = resolve(repoRoot, "scripts/amos-campaign-approval-demo.mjs");
const executionGateScript = resolve(repoRoot, "scripts/amos-execution-gate.mjs");
const taskQueueScript = resolve(repoRoot, "scripts/amos-task-queue.mjs");
const skillContractScript = resolve(repoRoot, "scripts/amos-skill-contract.mjs");
const fixturePath = resolve(repoRoot, "docs/design-thinking-system/fixtures/campaign-approval-demo.json");
const toolGraphPath = resolve(repoRoot, "docs/design-thinking-system/toolgraph/campaign-approval-demo.tools.json");
const taskQueuePath = resolve(repoRoot, "docs/design-thinking-system/fixtures/campaign-approval-task-queue.json");
const skillDir = resolve(repoRoot, "docs/design-thinking-system/mirrorskills/campaign-approval-demo");

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

function runExecutionGate({ decision, packet, fixture = fixturePath, toolGraph = toolGraphPath, outputDir }) {
  return spawnSync(
    process.execPath,
    [executionGateScript, "--decision", decision, "--packet", packet, "--fixture", fixture, "--toolgraph", toolGraph, "--output", outputDir],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
}

function runTaskQueue({ queue = taskQueuePath, outputDir }) {
  return spawnSync(process.execPath, [taskQueueScript, "--queue", queue, "--output", outputDir], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function runSkillContract({ skill = skillDir, outputDir }) {
  return spawnSync(process.execPath, [skillContractScript, "--skill", skill, "--output", outputDir], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

const tempRoot = mkdtempSync(join(tmpdir(), "amos-demo-guard-"));
const baseFixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const baseToolGraph = JSON.parse(readFileSync(toolGraphPath, "utf8"));

const positiveOutputDir = join(tempRoot, "positive");
expectPass(
  "positive demo fixture",
  runDemo({
    fixture: fixturePath,
    outputDir: positiveOutputDir,
  }),
);

const positivePacket = JSON.parse(readFileSync(join(positiveOutputDir, "approval-packet.json"), "utf8"));
const approvedDecisionPath = join(tempRoot, "approved-decision.json");
writeFileSync(
  approvedDecisionPath,
  `${JSON.stringify(
    {
      schema_version: "amos-approval-decision/v0.1",
      decision_id: "decision_guard_approved",
      packet_id: positivePacket.packet_id,
      workflow_id: positivePacket.workflow_id,
      decision: "approved",
      note: "Guard-approved local decision.",
      external_actions_executed: [],
      requires_execution_gate: true,
      recorded_at: "2026-07-02T00:00:00.000Z",
    },
    null,
    2,
  )}\n`,
);
expectPass(
  "approved decision is held by execution gate",
  runExecutionGate({
    decision: approvedDecisionPath,
    packet: join(positiveOutputDir, "approval-packet.json"),
    outputDir: join(tempRoot, "execution-approved"),
  }),
);

const queueOutputDir = join(tempRoot, "queue");
expectPass(
  "task queue runs draft approval and execution gate",
  runTaskQueue({
    outputDir: queueOutputDir,
  }),
);

const queueReceipt = JSON.parse(readFileSync(join(queueOutputDir, "task-queue-run.json"), "utf8"));
if (queueReceipt.status !== "passed") {
  console.error(`task queue did not pass: ${queueReceipt.status}`);
  process.exit(1);
}
if (queueReceipt.external_actions_executed.length !== 0) {
  console.error("task queue executed an external action");
  process.exit(1);
}
const queueExecutionTask = queueReceipt.tasks.find((task) => task.task_id === "check_execution_gate");
if (queueExecutionTask?.verdict !== "held_scope_forbids_external_execution") {
  console.error(`task queue execution verdict was wrong: ${queueExecutionTask?.verdict}`);
  process.exit(1);
}

expectPass(
  "mirrorskill contract validates and runs queue",
  runSkillContract({
    outputDir: join(tempRoot, "skill"),
  }),
);

const badQueue = JSON.parse(readFileSync(taskQueuePath, "utf8"));
badQueue.tasks = [
  {
    task_id: "bad_execution_first",
    kind: "execution_gate",
    requires: ["record_local_decision"],
    expected_verdict: "held_scope_forbids_external_execution",
  },
];
const badQueuePath = join(tempRoot, "bad-queue.json");
writeFileSync(badQueuePath, `${JSON.stringify(badQueue, null, 2)}\n`);
expectFail(
  "task queue blocks unmet dependency",
  runTaskQueue({
    queue: badQueuePath,
    outputDir: join(tempRoot, "bad-queue"),
  }),
  "dependency_not_completed",
);

const approvedGateReceipt = JSON.parse(readFileSync(join(tempRoot, "execution-approved", "execution-gate-receipt.json"), "utf8"));
if (approvedGateReceipt.verdict !== "held_scope_forbids_external_execution") {
  console.error(`approved decision was not held by scope gate: ${approvedGateReceipt.verdict}`);
  process.exit(1);
}

const declinedDecisionPath = join(tempRoot, "declined-decision.json");
writeFileSync(
  declinedDecisionPath,
  `${JSON.stringify(
    {
      schema_version: "amos-approval-decision/v0.1",
      decision_id: "decision_guard_declined",
      packet_id: positivePacket.packet_id,
      workflow_id: positivePacket.workflow_id,
      decision: "declined",
      note: "Guard-declined local decision.",
      external_actions_executed: [],
      requires_execution_gate: false,
      recorded_at: "2026-07-02T00:00:00.000Z",
    },
    null,
    2,
  )}\n`,
);
expectPass(
  "declined decision blocks execution gate",
  runExecutionGate({
    decision: declinedDecisionPath,
    packet: join(positiveOutputDir, "approval-packet.json"),
    outputDir: join(tempRoot, "execution-declined"),
  }),
);

const declinedGateReceipt = JSON.parse(readFileSync(join(tempRoot, "execution-declined", "execution-gate-receipt.json"), "utf8"));
if (declinedGateReceipt.verdict !== "blocked_declined") {
  console.error(`declined decision had wrong verdict: ${declinedGateReceipt.verdict}`);
  process.exit(1);
}

const tamperedDecisionPath = join(tempRoot, "tampered-decision.json");
writeFileSync(
  tamperedDecisionPath,
  `${JSON.stringify(
    {
      schema_version: "amos-approval-decision/v0.1",
      decision_id: "decision_guard_tampered",
      packet_id: "approval_wrong_packet",
      workflow_id: positivePacket.workflow_id,
      decision: "approved",
      note: "Tampered packet id.",
      external_actions_executed: [],
      requires_execution_gate: true,
      recorded_at: "2026-07-02T00:00:00.000Z",
    },
    null,
    2,
  )}\n`,
);
expectFail(
  "tampered decision receipt",
  runExecutionGate({
    decision: tamperedDecisionPath,
    packet: join(positiveOutputDir, "approval-packet.json"),
    outputDir: join(tempRoot, "execution-tampered"),
  }),
  "decision_packet_mismatch",
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
        "approved_decision_held_by_execution_gate",
        "declined_decision_blocks_execution_gate",
        "tampered_decision_fails_execution_gate",
        "task_queue_runs_traceable_workflow",
        "task_queue_blocks_unmet_dependency",
        "mirrorskill_contract_validates",
      ],
      temp_root: tempRoot,
    },
    null,
    2,
  ),
);

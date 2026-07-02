import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const defaultOutputDir = resolve(process.env.AMOS_DEMO_OUTPUT_DIR || "/tmp/active-mirror-site/amos-campaign-approval-demo");

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  if (!process.argv[index]?.startsWith("--")) continue;
  args.set(process.argv[index].slice(2), process.argv[index + 1]);
}

const fixturePath = resolve(
  args.get("fixture") ||
    process.env.AMOS_DEMO_FIXTURE ||
    resolve(repoRoot, "docs/design-thinking-system/fixtures/campaign-approval-demo.json"),
);
const toolGraphPath = resolve(
  args.get("toolgraph") ||
    process.env.AMOS_DEMO_TOOLGRAPH ||
    resolve(repoRoot, "docs/design-thinking-system/toolgraph/campaign-approval-demo.tools.json"),
);
const approvalPacketPath = resolve(
  args.get("packet") || process.env.AMOS_APPROVAL_PACKET || resolve(defaultOutputDir, "approval-packet.json"),
);
const decisionPath = args.get("decision") || process.env.AMOS_APPROVAL_DECISION;
const outputDir = resolve(args.get("output") || process.env.AMOS_EXECUTION_GATE_OUTPUT_DIR || defaultOutputDir);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function canonicalString(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalString(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalString(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return createHash("sha256").update(typeof value === "string" ? value : canonicalString(value)).digest("hex").slice(0, 24);
}

function toolByName(toolGraph, name) {
  return toolGraph.tools.find((tool) => tool.name === name);
}

function validateDecision({ fixture, toolGraph, packet, decision }) {
  const failures = [];

  if (!decision) failures.push("decision_missing");
  if (decision?.schema_version !== "amos-approval-decision/v0.1") failures.push("decision_schema_mismatch");
  if (decision?.packet_id !== packet.packet_id) failures.push("decision_packet_mismatch");
  if (decision?.workflow_id !== packet.workflow_id || packet.workflow_id !== fixture.workflow_id) {
    failures.push("decision_workflow_mismatch");
  }
  if (!["approved", "declined"].includes(decision?.decision)) failures.push("decision_value_invalid");
  if (!Array.isArray(decision?.external_actions_executed) || decision.external_actions_executed.length !== 0) {
    failures.push("decision_claims_external_execution");
  }
  if (decision?.decision === "approved" && decision?.requires_execution_gate !== true) {
    failures.push("approved_decision_missing_execution_gate");
  }
  if (decision?.decision === "declined" && decision?.requires_execution_gate !== false) {
    failures.push("declined_decision_requires_execution");
  }

  for (const action of packet.held_actions || []) {
    const tool = toolByName(toolGraph, action.tool);
    if (!tool) failures.push(`tool_not_registered:${action.tool}`);
    if (tool?.approval_class !== action.approval_class) failures.push(`tool_class_mismatch:${action.action_id}`);
    if (action.approval_class === "Act" && !tool?.sends_messages && !tool?.external_network) {
      failures.push(`act_tool_has_no_external_capability:${action.tool}`);
    }
  }

  return failures;
}

function buildExecutionGateReceipt({ fixture, packet, decision, failures }) {
  let verdict = "invalid";
  let reason = "Decision receipt failed validation.";
  let next_required_gate = "fix_decision_receipt";

  if (failures.length === 0 && decision.decision === "declined") {
    verdict = "blocked_declined";
    reason = "Human declined the held action. No execution is allowed.";
    next_required_gate = "none";
  }

  if (failures.length === 0 && decision.decision === "approved" && !fixture.scope.external_action_allowed) {
    verdict = "held_scope_forbids_external_execution";
    reason = "Human approval was recorded, but workflow scope still forbids external execution.";
    next_required_gate = "scope_egress_approval";
  }

  if (failures.length === 0 && decision.decision === "approved" && fixture.scope.external_action_allowed) {
    verdict = "ready_for_executor";
    reason = "Decision receipt is valid and workflow scope allows external execution.";
    next_required_gate = "connector_specific_execution_gate";
  }

  return {
    schema_version: "amos-execution-gate/v0.1",
    gate_id: `execgate_${hash({ packet_id: packet.packet_id, decision_id: decision?.decision_id, verdict, failures })}`,
    workflow_id: fixture.workflow_id,
    packet_id: packet.packet_id,
    decision_id: decision?.decision_id || null,
    verdict,
    reason,
    failures,
    external_actions_executed: [],
    next_required_gate,
    checked_at: "2026-07-02T00:00:00.000Z",
  };
}

if (!decisionPath) {
  console.error("Missing decision receipt. Pass --decision <path> or set AMOS_APPROVAL_DECISION.");
  process.exit(1);
}

const fixture = readJson(fixturePath);
const toolGraph = readJson(toolGraphPath);
const packet = readJson(approvalPacketPath);
const decision = readJson(resolve(decisionPath));
const failures = validateDecision({ fixture, toolGraph, packet, decision });
const receipt = buildExecutionGateReceipt({ fixture, packet, decision, failures });

mkdirSync(outputDir, { recursive: true });
writeFileSync(resolve(outputDir, "execution-gate-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);

console.log(JSON.stringify({ ok: failures.length === 0, ...receipt, output_dir: outputDir }, null, 2));

if (failures.length) process.exit(1);

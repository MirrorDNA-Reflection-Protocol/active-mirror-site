import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  if (!process.argv[index]?.startsWith("--")) continue;
  args.set(process.argv[index].slice(2), process.argv[index + 1]);
}

const queuePath = resolve(
  args.get("queue") ||
    process.env.AMOS_TASK_QUEUE ||
    resolve(repoRoot, "docs/design-thinking-system/fixtures/campaign-approval-task-queue.json"),
);
const outputDir = resolve(args.get("output") || process.env.AMOS_TASK_QUEUE_OUTPUT_DIR || "/tmp/active-mirror-site/amos-task-queue");

const forbiddenMarkers = [
  /\bSWFI\b/i,
  /Sovereign Wealth Fund Institute/i,
  /\bDipika\b/i,
  /client-confidential/i,
  /sovereign-fund space/i,
];

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

function relativeResolve(path) {
  return resolve(repoRoot, path);
}

function hasForbiddenMarkers(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return forbiddenMarkers.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}

function runNode(script, argsList, env = {}) {
  return spawnSync(process.execPath, [resolve(repoRoot, script), ...argsList], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function writeEvent(events, event) {
  const fullEvent = {
    event_id: `queueevt_${hash({ at: "2026-07-02T00:00:00.000Z", event })}`,
    at: "2026-07-02T00:00:00.000Z",
    ...event,
  };
  events.push(fullEvent);
}

function failTask({ events, task, reason, details = [] }) {
  writeEvent(events, {
    type: "task_failed",
    task_id: task?.task_id || "queue",
    reason,
    details,
  });
  return {
    task_id: task?.task_id || "queue",
    kind: task?.kind || "unknown",
    status: "failed",
    reason,
    details,
  };
}

function assertRequires({ task, completed }) {
  return (task.requires || []).filter((taskId) => !completed.has(taskId));
}

function buildDecision({ queue, task, packet }) {
  return {
    schema_version: "amos-approval-decision/v0.1",
    decision_id: `decision_${hash({ queue_id: queue.queue_id, task_id: task.task_id, packet_id: packet.packet_id, decision: task.decision })}`,
    packet_id: packet.packet_id,
    workflow_id: packet.workflow_id,
    decision: task.decision,
    note: task.note || "",
    external_actions_executed: [],
    requires_execution_gate: task.decision === "approved",
    recorded_at: "2026-07-02T00:00:00.000Z",
  };
}

mkdirSync(outputDir, { recursive: true });

const queue = readJson(queuePath);
const events = [];
const completed = new Set();
const taskResults = [];

writeEvent(events, {
  type: "queue_loaded",
  queue_id: queue.queue_id,
  workflow_id: queue.workflow_id,
});

const queueLeakMarkers = hasForbiddenMarkers(queue);
if (queueLeakMarkers.length) {
  taskResults.push(failTask({ events, task: null, reason: "queue_client_boundary_leak", details: queueLeakMarkers }));
} else {
  for (const task of queue.tasks || []) {
    writeEvent(events, { type: "task_started", task_id: task.task_id, kind: task.kind });

    const missingDependencies = assertRequires({ task, completed });
    if (missingDependencies.length) {
      taskResults.push(failTask({ events, task, reason: "dependency_not_completed", details: missingDependencies }));
      break;
    }

    if (task.kind === "demo") {
      const result = runNode("scripts/amos-campaign-approval-demo.mjs", [], {
        AMOS_DEMO_FIXTURE: relativeResolve(queue.fixture),
        AMOS_DEMO_TOOLGRAPH: relativeResolve(queue.toolgraph),
        AMOS_DEMO_OUTPUT_DIR: outputDir,
      });

      if (result.status !== 0) {
        taskResults.push(failTask({ events, task, reason: "demo_failed", details: [result.stdout, result.stderr].filter(Boolean) }));
        break;
      }

      const receipt = readJson(resolve(outputDir, "receipt.json"));
      if (task.expected_status && receipt.status !== task.expected_status) {
        taskResults.push(failTask({ events, task, reason: "demo_status_mismatch", details: [receipt.status, task.expected_status] }));
        break;
      }

      completed.add(task.task_id);
      taskResults.push({
        task_id: task.task_id,
        kind: task.kind,
        status: "passed",
        receipt_id: receipt.receipt_id,
        produced: task.produces || [],
      });
      writeEvent(events, { type: "task_completed", task_id: task.task_id, status: "passed", receipt_id: receipt.receipt_id });
      continue;
    }

    if (task.kind === "decision") {
      if (!["approved", "declined"].includes(task.decision)) {
        taskResults.push(failTask({ events, task, reason: "decision_value_invalid", details: [task.decision] }));
        break;
      }
      const packetPath = resolve(outputDir, "approval-packet.json");
      if (!existsSync(packetPath)) {
        taskResults.push(failTask({ events, task, reason: "approval_packet_missing", details: [packetPath] }));
        break;
      }

      const packet = readJson(packetPath);
      const decision = buildDecision({ queue, task, packet });
      const decisionPath = resolve(outputDir, `${task.decision}-decision.json`);
      writeFileSync(decisionPath, `${JSON.stringify(decision, null, 2)}\n`);

      completed.add(task.task_id);
      taskResults.push({
        task_id: task.task_id,
        kind: task.kind,
        status: "passed",
        decision_id: decision.decision_id,
        produced: [decisionPath],
      });
      writeEvent(events, { type: "task_completed", task_id: task.task_id, status: "passed", decision_id: decision.decision_id });
      continue;
    }

    if (task.kind === "execution_gate") {
      const approvedDecisionPath = resolve(outputDir, "approved-decision.json");
      const declinedDecisionPath = resolve(outputDir, "declined-decision.json");
      const decisionPath = existsSync(approvedDecisionPath) ? approvedDecisionPath : declinedDecisionPath;
      if (!existsSync(decisionPath)) {
        taskResults.push(failTask({ events, task, reason: "decision_receipt_missing", details: [approvedDecisionPath, declinedDecisionPath] }));
        break;
      }

      const result = runNode("scripts/amos-execution-gate.mjs", [
        "--decision",
        decisionPath,
        "--packet",
        resolve(outputDir, "approval-packet.json"),
        "--fixture",
        relativeResolve(queue.fixture),
        "--toolgraph",
        relativeResolve(queue.toolgraph),
        "--output",
        outputDir,
      ]);

      if (result.status !== 0) {
        taskResults.push(failTask({ events, task, reason: "execution_gate_failed", details: [result.stdout, result.stderr].filter(Boolean) }));
        break;
      }

      const gateReceipt = readJson(resolve(outputDir, "execution-gate-receipt.json"));
      if (task.expected_verdict && gateReceipt.verdict !== task.expected_verdict) {
        taskResults.push(failTask({ events, task, reason: "execution_verdict_mismatch", details: [gateReceipt.verdict, task.expected_verdict] }));
        break;
      }

      completed.add(task.task_id);
      taskResults.push({
        task_id: task.task_id,
        kind: task.kind,
        status: "passed",
        gate_id: gateReceipt.gate_id,
        verdict: gateReceipt.verdict,
        produced: task.produces || [],
      });
      writeEvent(events, { type: "task_completed", task_id: task.task_id, status: "passed", gate_id: gateReceipt.gate_id, verdict: gateReceipt.verdict });
      continue;
    }

    if (task.kind === "copy_audit") {
      const result = runNode("scripts/amos-public-copy-friction-sweep.mjs", ["--output", outputDir]);

      if (result.status !== 0) {
        taskResults.push(failTask({ events, task, reason: "copy_audit_failed", details: [result.stdout, result.stderr].filter(Boolean) }));
        break;
      }

      const report = readJson(resolve(outputDir, "public-copy-friction-report.json"));
      if (task.expected_status && report.status !== task.expected_status) {
        taskResults.push(failTask({ events, task, reason: "copy_audit_status_mismatch", details: [report.status, task.expected_status] }));
        break;
      }

      completed.add(task.task_id);
      taskResults.push({
        task_id: task.task_id,
        kind: task.kind,
        status: "passed",
        sweep_id: report.sweep_id,
        produced: task.produces || [],
      });
      writeEvent(events, { type: "task_completed", task_id: task.task_id, status: "passed", sweep_id: report.sweep_id });
      continue;
    }

    taskResults.push(failTask({ events, task, reason: "unknown_task_kind", details: [task.kind] }));
    break;
  }
}

const passed = taskResults.length === (queue.tasks || []).length && taskResults.every((task) => task.status === "passed");
const queueReceipt = {
  schema_version: "amos-task-queue-run/v0.1",
  queue_run_id: `queuerun_${hash({ queue, taskResults })}`,
  queue_id: queue.queue_id,
  workflow_id: queue.workflow_id,
  status: passed ? "passed" : "failed",
  tasks: taskResults,
  external_actions_executed: [],
  output_dir: outputDir,
  risks_remaining: queue.risks_remaining || [
    "This queue uses a demo fixture and does not execute connectors.",
    "Approved decisions still require execution-gate and scope checks before any real action.",
  ],
};

writeEvent(events, { type: "queue_finished", queue_id: queue.queue_id, status: queueReceipt.status });
writeFileSync(resolve(outputDir, "task-events.jsonl"), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
writeFileSync(resolve(outputDir, "task-queue-run.json"), `${JSON.stringify(queueReceipt, null, 2)}\n`);

console.log(JSON.stringify({ ok: passed, ...queueReceipt }, null, 2));

if (!passed) process.exit(1);

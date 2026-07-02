import { existsSync, readFileSync } from "node:fs";
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

const skillDir = resolve(
  args.get("skill") ||
    process.env.AMOS_SKILL_DIR ||
    resolve(repoRoot, "docs/design-thinking-system/mirrorskills/campaign-approval-demo"),
);
const outputDir = resolve(args.get("output") || process.env.AMOS_SKILL_OUTPUT_DIR || "/tmp/active-mirror-site/amos-skill");
const runQueue = args.get("run-queue") !== "false";

const requiredTopLevel = [
  "schema_version",
  "skill_id",
  "version",
  "owner",
  "purpose",
  "risk_level",
  "inputs",
  "outputs",
  "permissions",
  "denied_permissions",
  "queue",
  "test_command",
  "guard_command",
  "receipt_fields",
  "failure_modes",
  "promotion_rule",
  "retirement_rule",
];

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

function markerHits(text) {
  return forbiddenMarkers.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}

function missingFields(contract) {
  return requiredTopLevel.filter((field) => contract[field] === undefined || contract[field] === null || contract[field] === "");
}

function arrayFieldFailures(contract, fields) {
  return fields.filter((field) => !Array.isArray(contract[field]) || contract[field].length === 0);
}

function requireRepoFile(path) {
  const fullPath = resolve(repoRoot, path);
  return existsSync(fullPath) ? null : fullPath;
}

const contractPath = resolve(skillDir, "contract.json");
const skillReadmePath = resolve(skillDir, "SKILL.md");
const failures = [];

if (!existsSync(contractPath)) failures.push(`missing_contract:${contractPath}`);
if (!existsSync(skillReadmePath)) failures.push(`missing_skill_doc:${skillReadmePath}`);

const contract = existsSync(contractPath) ? readJson(contractPath) : {};
for (const field of missingFields(contract)) failures.push(`missing_field:${field}`);
for (const field of arrayFieldFailures(contract, ["inputs", "outputs", "permissions", "denied_permissions", "receipt_fields", "failure_modes"])) {
  failures.push(`empty_array:${field}`);
}

const contractText = existsSync(contractPath) ? readFileSync(contractPath, "utf8") : "";
const skillText = existsSync(skillReadmePath) ? readFileSync(skillReadmePath, "utf8") : "";
const forbidden = markerHits(`${contractText}\n${skillText}`);
if (forbidden.length) failures.push(`forbidden_marker:${forbidden.join(",")}`);

for (const input of contract.inputs || []) {
  if (!input.name || !input.type || !input.source) failures.push(`invalid_input:${JSON.stringify(input)}`);
  const missing = input.source ? requireRepoFile(input.source) : null;
  if (missing) failures.push(`missing_input_source:${missing}`);
}

if (contract.queue) {
  const missing = requireRepoFile(contract.queue);
  if (missing) failures.push(`missing_queue:${missing}`);
}

if (!contract.denied_permissions?.includes("send_message")) failures.push("missing_denied_permission:send_message");
if (!contract.denied_permissions?.includes("call_external_connector")) failures.push("missing_denied_permission:call_external_connector");
if (!contract.receipt_fields?.includes("external_actions_executed")) failures.push("missing_receipt_field:external_actions_executed");
if (contract.promotion_rule?.status !== "candidate") failures.push("promotion_status_not_candidate");

let queueSmoke = null;
if (!failures.length && runQueue) {
  const queueRun = spawnSync(process.execPath, [resolve(repoRoot, "scripts/amos-task-queue.mjs"), "--queue", resolve(repoRoot, contract.queue), "--output", outputDir], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  queueSmoke = {
    status: queueRun.status,
    stdout: queueRun.stdout,
    stderr: queueRun.stderr,
  };

  if (queueRun.status !== 0) failures.push("queue_smoke_failed");
}

const result = {
  ok: failures.length === 0,
  skill_id: contract.skill_id || "unknown",
  skill_dir: skillDir,
  contract: contractPath,
  queue_output_dir: runQueue ? outputDir : null,
  checks: [
    "contract_present",
    "skill_doc_present",
    "required_fields",
    "referenced_files_exist",
    "forbidden_markers_absent",
    "denied_permissions_present",
    "receipt_fields_present",
    "candidate_promotion_status",
    runQueue ? "queue_smoke" : "queue_smoke_skipped",
  ],
  failures,
};

console.log(JSON.stringify(result, null, 2));

if (failures.length) {
  if (queueSmoke?.stdout) console.error(queueSmoke.stdout);
  if (queueSmoke?.stderr) console.error(queueSmoke.stderr);
  process.exit(1);
}

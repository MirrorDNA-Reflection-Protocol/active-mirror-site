import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const fixturePath = resolve(process.env.AMOS_DEMO_FIXTURE || resolve(repoRoot, "docs/design-thinking-system/fixtures/campaign-approval-demo.json"));
const outputDir = resolve(process.env.AMOS_DEMO_OUTPUT_DIR || "/tmp/active-mirror-site/amos-campaign-approval-demo");

const forbiddenClientMarkers = [
  /\bSWFI\b/i,
  /Sovereign Wealth Fund Institute/i,
  /\bDipika\b/i,
  /client-confidential/i,
  /sovereign-fund space/i,
  /\bBlackRock\b/i,
  /\bADIA\b/i,
  /\bGIC\b/i,
  /\bPIF\b/i,
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

function findForbiddenMarkers(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return forbiddenClientMarkers
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source);
}

function trustGate({ fixture, draft, action }) {
  const leakedMarkers = findForbiddenMarkers({ fixture, draft });
  if (leakedMarkers.length) {
    return {
      action_id: action.id,
      verdict: "block",
      risk_type: "client_boundary",
      reason: "Client-boundary markers appeared in a demo-only workflow.",
      safe_alternative: "Remove private or client-specific material and rerun with demo-approved context only.",
      requires_user_approval: false,
      glyphtrail_event: `gt_${hash(`${action.id}:client_boundary:${leakedMarkers.join("|")}`)}`,
    };
  }

  if (action.class === "Act" && !action.approval_granted) {
    return {
      action_id: action.id,
      verdict: "review",
      risk_type: "irreversible_action",
      reason: "External send/share actions require explicit approval before execution.",
      safe_alternative: "Keep the work as a local draft and prepare an approval packet.",
      requires_user_approval: true,
      glyphtrail_event: `gt_${hash(`${action.id}:approval_required`)}`,
    };
  }

  return {
    action_id: action.id,
    verdict: "allow",
    risk_type: "privacy",
    reason: "No privacy boundary was crossed; action stays inside the approved demo scope.",
    safe_alternative: "",
    requires_user_approval: false,
    glyphtrail_event: `gt_${hash(`${action.id}:allow`)}`,
  };
}

function buildDraft(fixture) {
  const { context } = fixture;
  return {
    title: "Product update: one useful change",
    subject: "A smaller way to try the new update",
    body: [
      "We made the next step easier to see.",
      `What changed: ${context.approved_brief}`,
      "Why it helps: the update keeps the message short enough to read and specific enough to act on.",
      "Try it next: pick one product change, write the user benefit in one sentence, and send it only after review.",
    ],
    status: "draft_only",
  };
}

function buildClaims({ fixture, draft, gates }) {
  return [
    {
      id: "claim_context_scope",
      text: "The draft used only the approved demo brief.",
      evidence: [fixture.workflow_id, "context.approved_brief"],
      status: "supported_by_fixture",
    },
    {
      id: "claim_external_action",
      text: "No external send/share action was executed.",
      evidence: gates.filter((gate) => gate.verdict === "review").map((gate) => gate.action_id),
      status: "supported_by_gate",
    },
    {
      id: "claim_draft_status",
      text: "The output is a reviewable draft, not a live campaign.",
      evidence: [draft.status],
      status: "supported_by_output",
    },
  ];
}

function buildScdState({ fixture, draft, gates, verifier }) {
  return {
    schema_version: "scd/amos-demo-v0.1",
    workflow_id: fixture.workflow_id,
    state_id: `scd_${hash({ workflow_id: fixture.workflow_id, draft, gates })}`,
    status: verifier.pass ? "draft_ready_approval_required" : "blocked",
    lane: fixture.scope.lane,
    client_scope: fixture.scope.client_scope,
    context_used: ["context.approved_brief", "context.audience", "context.tone", "context.boundary"],
    context_excluded: ["client data", "private identity context", "account details", "live external claims"],
    external_actions_executed: [],
    approval_required: gates.filter((gate) => gate.requires_user_approval).map((gate) => gate.action_id),
    memory_promoted: [],
  };
}

function buildGlyphTrail({ fixture, gates, verifier }) {
  const now = "2026-07-02T00:00:00.000Z";
  return [
    {
      event_id: `gt_${hash(`${fixture.workflow_id}:loaded`)}`,
      at: now,
      type: "workflow_loaded",
      workflow_id: fixture.workflow_id,
      scope: fixture.scope.client_scope,
    },
    ...gates.map((gate) => ({
      event_id: gate.glyphtrail_event,
      at: now,
      type: "trust_gate",
      action_id: gate.action_id,
      verdict: gate.verdict,
      risk_type: gate.risk_type,
      requires_user_approval: gate.requires_user_approval,
    })),
    {
      event_id: `gt_${hash(`${fixture.workflow_id}:verifier:${verifier.pass}`)}`,
      at: now,
      type: "verifier_report",
      pass: verifier.pass,
      failures: verifier.failures,
    },
  ];
}

function verify({ fixture, draft, gates, claims }) {
  const failures = [];

  const leakedMarkers = findForbiddenMarkers({ fixture, draft, claims });
  if (leakedMarkers.length) failures.push(`client_boundary_leak:${leakedMarkers.join(",")}`);

  const draftGate = gates.find((gate) => gate.action_id === "draft_launch_note");
  if (!draftGate || draftGate.verdict !== "allow") failures.push("draft_not_allowed");

  const sendGate = gates.find((gate) => gate.action_id === "send_launch_note");
  if (!sendGate || sendGate.verdict !== "review" || !sendGate.requires_user_approval) {
    failures.push("external_action_not_held_for_approval");
  }

  for (const claim of claims) {
    if (!Array.isArray(claim.evidence) || claim.evidence.length === 0) {
      failures.push(`claim_missing_evidence:${claim.id}`);
    }
  }

  if (fixture.scope.external_action_allowed) failures.push("fixture_allows_external_action");
  if (fixture.scope.memory_promotion_allowed) failures.push("fixture_allows_memory_promotion");

  return {
    pass: failures.length === 0,
    failures,
    checks: [
      "client_boundary",
      "draft_allowed",
      "external_action_approval",
      "claim_evidence",
      "memory_not_promoted",
    ],
  };
}

function writeReceipt({ fixture, draft, gates, claims, verifier, scdState, glyphTrail }) {
  mkdirSync(outputDir, { recursive: true });

  const receipt = {
    receipt_id: `amos_${hash({ fixture, draft, gates, claims, verifier, scdState })}`,
    date_time: "2026-07-02T00:00:00.000Z",
    human_goal: fixture.human_goal,
    task_performed: "Generated a local campaign draft and held external sending for approval.",
    status: verifier.pass ? "passed" : "failed",
    failures: verifier.failures,
    context_used: scdState.context_used,
    context_excluded: scdState.context_excluded,
    tools_used: ["local_draft", "trust_gate", "verifier", "scd_writer", "glyphtrail_writer"],
    external_actions: scdState.external_actions_executed,
    evidence: claims,
    tests_checks: verifier.checks,
    memory_decision: "No memory promoted. Demo candidate remains review-only.",
    risks_remaining: [
      "This is a local fixture, not a production approval surface.",
      "Real connectors need per-tool ToolGraph records before use.",
    ],
    output_dir: outputDir,
  };

  writeFileSync(resolve(outputDir, "SCD.json"), `${JSON.stringify(scdState, null, 2)}\n`);
  writeFileSync(resolve(outputDir, "GlyphTrail.log"), `${glyphTrail.map((event) => JSON.stringify(event)).join("\n")}\n`);
  writeFileSync(resolve(outputDir, "verifier-report.json"), `${JSON.stringify(verifier, null, 2)}\n`);
  writeFileSync(resolve(outputDir, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

const fixture = readJson(fixturePath);
const draft = buildDraft(fixture);
const gates = fixture.actions.map((action) => trustGate({ fixture, draft, action }));
const claims = buildClaims({ fixture, draft, gates });
const verifier = verify({ fixture, draft, gates, claims });
const scdState = buildScdState({ fixture, draft, gates, verifier });
const glyphTrail = buildGlyphTrail({ fixture, gates, verifier });
const receipt = writeReceipt({ fixture, draft, gates, claims, verifier, scdState, glyphTrail });

const summary = {
  ok: verifier.pass,
  receipt_id: receipt.receipt_id,
  output_dir: receipt.output_dir,
  allowed: gates.filter((gate) => gate.verdict === "allow").map((gate) => gate.action_id),
  approval_required: gates.filter((gate) => gate.requires_user_approval).map((gate) => gate.action_id),
  failures: verifier.failures,
};

console.log(JSON.stringify(summary, null, 2));

if (!verifier.pass) process.exit(1);

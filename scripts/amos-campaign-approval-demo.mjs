import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const fixturePath = resolve(process.env.AMOS_DEMO_FIXTURE || resolve(repoRoot, "docs/design-thinking-system/fixtures/campaign-approval-demo.json"));
const toolGraphPath = resolve(process.env.AMOS_DEMO_TOOLGRAPH || resolve(repoRoot, "docs/design-thinking-system/toolgraph/campaign-approval-demo.tools.json"));
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

function toolByName(toolGraph, name) {
  return toolGraph.tools.find((tool) => tool.name === name);
}

function buildRoutePlan({ fixture, toolGraph }) {
  return fixture.actions.map((action) => {
    const tool = toolByName(toolGraph, action.tool);
    return {
      action_id: action.id,
      tool: action.tool,
      tool_registered: Boolean(tool),
      approval_class: action.class,
      tool_approval_class: tool?.approval_class || "missing",
      risk_level: tool?.risk_level || "blocked",
      external_network: Boolean(tool?.external_network),
      sends_messages: Boolean(tool?.sends_messages),
      fallback: tool?.fallback || "Block because the tool is not registered.",
    };
  });
}

function trustGate({ fixture, draft, action, toolGraph }) {
  const tool = toolByName(toolGraph, action.tool);
  if (!tool) {
    return {
      action_id: action.id,
      verdict: "block",
      risk_type: "security",
      reason: "Action references a tool with no ToolGraph record.",
      safe_alternative: "Register the tool with purpose, permissions, risk, fallback, and test before use.",
      requires_user_approval: false,
      glyphtrail_event: `gt_${hash(`${action.id}:missing_tool:${action.tool}`)}`,
    };
  }

  if (tool.approval_class !== action.class) {
    return {
      action_id: action.id,
      verdict: "block",
      risk_type: "security",
      reason: "Action approval class does not match the ToolGraph record.",
      safe_alternative: "Align the action with the registered tool class or create a new tool record.",
      requires_user_approval: false,
      glyphtrail_event: `gt_${hash(`${action.id}:class_mismatch:${action.class}:${tool.approval_class}`)}`,
    };
  }

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

  if (action.class === "Act" && action.approval_granted && !fixture.scope.external_action_allowed) {
    return {
      action_id: action.id,
      verdict: "block",
      risk_type: "irreversible_action",
      reason: "Approval was present, but this workflow scope still forbids external execution.",
      safe_alternative: "Keep the action as a local approval packet until the workflow scope explicitly allows egress.",
      requires_user_approval: true,
      glyphtrail_event: `gt_${hash(`${action.id}:scope_forbids_external_execution`)}`,
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

function buildApprovalPacket({ fixture, draft, gates, routePlan }) {
  const heldActions = gates.filter((gate) => gate.requires_user_approval);
  return {
    packet_id: `approval_${hash({ workflow_id: fixture.workflow_id, heldActions, draft })}`,
    workflow_id: fixture.workflow_id,
    title: "Review before sending",
    summary: "A local draft is ready. The external action is held until approval is explicit and in scope.",
    draft,
    held_actions: heldActions.map((gate) => {
      const route = routePlan.find((item) => item.action_id === gate.action_id);
      return {
        action_id: gate.action_id,
        tool: route?.tool || "unknown",
        approval_class: route?.approval_class || "unknown",
        reason: gate.reason,
        fallback: gate.safe_alternative || route?.fallback || "Keep as local draft.",
      };
    }),
    approval_state: heldActions.length ? "approval_required" : "no_approval_required",
  };
}

function buildScdState({ fixture, draft, gates, verifier, routePlan, approvalPacket }) {
  return {
    schema_version: "scd/amos-demo-v0.1",
    workflow_id: fixture.workflow_id,
    state_id: `scd_${hash({ workflow_id: fixture.workflow_id, draft, gates })}`,
    status: verifier.pass ? "draft_ready_approval_required" : "blocked",
    lane: fixture.scope.lane,
    client_scope: fixture.scope.client_scope,
    context_used: ["context.approved_brief", "context.audience", "context.tone", "context.boundary"],
    context_excluded: ["client data", "private identity context", "account details", "live external claims"],
    route_plan: routePlan,
    external_actions_executed: [],
    approval_required: gates.filter((gate) => gate.requires_user_approval).map((gate) => gate.action_id),
    approval_packet: approvalPacket.packet_id,
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

function verify({ fixture, draft, gates, claims, toolGraph, routePlan, approvalPacket }) {
  const failures = [];

  const leakedMarkers = findForbiddenMarkers({ fixture, draft, claims });
  if (leakedMarkers.length) failures.push(`client_boundary_leak:${leakedMarkers.join(",")}`);

  const draftGate = gates.find((gate) => gate.action_id === "draft_launch_note");
  if (!draftGate || draftGate.verdict !== "allow") failures.push("draft_not_allowed");

  const sendGate = gates.find((gate) => gate.action_id === "send_launch_note");
  if (!sendGate || sendGate.verdict !== "review" || !sendGate.requires_user_approval) {
    failures.push("external_action_not_held_for_approval");
  }

  if (!Array.isArray(toolGraph.tools) || toolGraph.tools.length === 0) failures.push("toolgraph_empty");
  for (const route of routePlan) {
    if (!route.tool_registered) failures.push(`tool_not_registered:${route.tool}`);
    if (route.approval_class !== route.tool_approval_class) {
      failures.push(`tool_approval_class_mismatch:${route.action_id}`);
    }
  }

  if (sendGate?.requires_user_approval && approvalPacket.approval_state !== "approval_required") {
    failures.push("approval_packet_missing_required_state");
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
      "toolgraph_registration",
      "toolgraph_approval_class",
      "approval_packet",
      "claim_evidence",
      "memory_not_promoted",
    ],
  };
}

function approvalPacketMarkdown(packet) {
  const held = packet.held_actions
    .map((action) => `- ${action.action_id} (${action.tool}): ${action.reason}`)
    .join("\n");
  const body = packet.draft.body.map((line) => `> ${line}`).join("\n");
  return `# ${packet.title}

${packet.summary}

## Draft

Subject: ${packet.draft.subject}

${body}

## Held Actions

${held || "- None"}

## Approval State

${packet.approval_state}
`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function approvalConsoleHtml(packet) {
  const held = packet.held_actions
    .map((action) => `<li><strong>${escapeHtml(action.action_id)}</strong> via ${escapeHtml(action.tool)}<br><span>${escapeHtml(action.reason)}</span></li>`)
    .join("");
  const body = packet.draft.body.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  const packetJson = JSON.stringify(packet).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(packet.title)}</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; padding: 32px; background: #0f1014; color: #f5f2ea; }
    main { max-width: 760px; margin: 0 auto; }
    section { border: 1px solid rgba(245,242,234,.18); border-radius: 8px; padding: 20px; margin: 16px 0; background: rgba(255,255,255,.04); }
    button { min-height: 44px; border-radius: 8px; border: 1px solid rgba(245,242,234,.22); padding: 0 18px; color: #f5f2ea; background: rgba(255,255,255,.08); font: inherit; cursor: pointer; }
    button.primary { background: #38d5c8; border-color: #38d5c8; color: #071112; }
    button.danger { background: rgba(255,112,91,.14); border-color: rgba(255,112,91,.58); }
    button:focus-visible { outline: 3px solid rgba(56,213,200,.42); outline-offset: 3px; }
    textarea { width: 100%; min-height: 88px; box-sizing: border-box; border-radius: 8px; border: 1px solid rgba(245,242,234,.18); padding: 12px; background: rgba(0,0,0,.22); color: inherit; font: inherit; resize: vertical; }
    pre { overflow: auto; border-radius: 8px; padding: 16px; background: rgba(0,0,0,.32); border: 1px solid rgba(245,242,234,.14); }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; }
    h1, h2 { letter-spacing: 0; }
    .state { display: inline-flex; padding: 6px 10px; border: 1px solid #38d5c8; border-radius: 999px; color: #38d5c8; }
    li { margin: 10px 0; }
    span { color: #c9c3b8; }
  </style>
</head>
<body>
  <main>
    <p class="state">${escapeHtml(packet.approval_state)}</p>
    <h1>${escapeHtml(packet.title)}</h1>
    <p>${escapeHtml(packet.summary)}</p>
    <section>
      <h2>Draft</h2>
      <p><strong>Subject:</strong> ${escapeHtml(packet.draft.subject)}</p>
      ${body}
    </section>
    <section>
      <h2>Held Actions</h2>
      <ul>${held || "<li>None</li>"}</ul>
    </section>
    <section>
      <h2>Decision</h2>
      <p>This records a local decision only. It does not send, publish, or call an external tool.</p>
      <label for="approval-note">Note</label>
      <textarea id="approval-note" placeholder="Optional note for the receipt"></textarea>
      <div class="actions">
        <button class="primary" data-decision="approved" type="button">Approve draft</button>
        <button class="danger" data-decision="declined" type="button">Decline</button>
        <button id="download-decision" type="button" disabled>Download decision</button>
      </div>
      <pre id="decision-receipt" aria-live="polite">No decision recorded.</pre>
    </section>
  </main>
  <script type="application/json" id="approval-packet">${packetJson}</script>
  <script>
    const packet = JSON.parse(document.getElementById("approval-packet").textContent);
    const receipt = document.getElementById("decision-receipt");
    const note = document.getElementById("approval-note");
    const download = document.getElementById("download-decision");
    let currentDecision = null;

    function buildDecision(decision) {
      return {
        schema_version: "amos-approval-decision/v0.1",
        decision_id: "decision_" + packet.packet_id + "_" + decision + "_" + Date.now().toString(36),
        packet_id: packet.packet_id,
        workflow_id: packet.workflow_id,
        decision,
        note: note.value.trim(),
        external_actions_executed: [],
        requires_execution_gate: decision === "approved",
        recorded_at: new Date().toISOString(),
        message: decision === "approved"
          ? "Approval recorded locally. External execution still requires the execution gate."
          : "Decline recorded locally. No action will be executed."
      };
    }

    function recordDecision(decision) {
      currentDecision = buildDecision(decision);
      localStorage.setItem("amos_approval_decision:" + packet.packet_id, JSON.stringify(currentDecision));
      receipt.textContent = JSON.stringify(currentDecision, null, 2);
      download.disabled = false;
    }

    document.querySelectorAll("[data-decision]").forEach((button) => {
      button.addEventListener("click", () => recordDecision(button.dataset.decision));
    });

    download.addEventListener("click", () => {
      if (!currentDecision) return;
      const blob = new Blob([JSON.stringify(currentDecision, null, 2) + "\\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = currentDecision.decision_id + ".json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
  </script>
</body>
</html>
`;
}

function writeReceipt({ fixture, draft, gates, claims, verifier, scdState, glyphTrail, routePlan, approvalPacket }) {
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
    route_plan: routePlan,
    tools_used: ["local_draft", "trust_gate", "verifier", "scd_writer", "glyphtrail_writer"],
    external_actions: scdState.external_actions_executed,
    approval_packet: approvalPacket.packet_id,
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
  writeFileSync(resolve(outputDir, "approval-packet.json"), `${JSON.stringify(approvalPacket, null, 2)}\n`);
  writeFileSync(resolve(outputDir, "approval-packet.md"), approvalPacketMarkdown(approvalPacket));
  writeFileSync(resolve(outputDir, "approval-packet.html"), approvalConsoleHtml(approvalPacket));
  writeFileSync(resolve(outputDir, "approval-console.html"), approvalConsoleHtml(approvalPacket));
  writeFileSync(resolve(outputDir, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);

  return receipt;
}

const fixture = readJson(fixturePath);
const toolGraph = readJson(toolGraphPath);
const draft = buildDraft(fixture);
const routePlan = buildRoutePlan({ fixture, toolGraph });
const gates = fixture.actions.map((action) => trustGate({ fixture, draft, action, toolGraph }));
const claims = buildClaims({ fixture, draft, gates });
const approvalPacket = buildApprovalPacket({ fixture, draft, gates, routePlan });
const verifier = verify({ fixture, draft, gates, claims, toolGraph, routePlan, approvalPacket });
const scdState = buildScdState({ fixture, draft, gates, verifier, routePlan, approvalPacket });
const glyphTrail = buildGlyphTrail({ fixture, gates, verifier });
const receipt = writeReceipt({ fixture, draft, gates, claims, verifier, scdState, glyphTrail, routePlan, approvalPacket });

const summary = {
  ok: verifier.pass,
  receipt_id: receipt.receipt_id,
  output_dir: receipt.output_dir,
  approval_packet: approvalPacket.packet_id,
  allowed: gates.filter((gate) => gate.verdict === "allow").map((gate) => gate.action_id),
  approval_required: gates.filter((gate) => gate.requires_user_approval).map((gate) => gate.action_id),
  failures: verifier.failures,
};

console.log(JSON.stringify(summary, null, 2));

if (!verifier.pass) process.exit(1);

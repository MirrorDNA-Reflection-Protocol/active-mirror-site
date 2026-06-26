// =============================================================================
// Active Mirror — Governance Kernel
//
// A deterministic, model-agnostic core that sits between any model (untrusted,
// stochastic inference) and a user. It does not run inference; it GOVERNS it:
//
//   1. boundary gate  (privacy line)   — secrets never reach the model
//   2. prompt + schema (shape line)    — the model can only return a reflection
//   3. straitjacket    (honesty floor) — strips flattery, forces one move + a real question
//   4. receipt         (record line)   — a content hash of exactly what was produced
//
// Inject ANY model as:
//   callModel(prompt, schema) => Promise<{ mirror, fallback, routeText } | null>
//     - mirror:    a parsed object matching MIRROR_SCHEMA, or null if none was produced
//     - fallback:  true if a backup route/model was used (the runtime's notion)
//     - routeText: a short public sentence describing the route, for the receipt
//
// The ONLY host dependency is Web Crypto (crypto.subtle) — present in Cloudflare
// Workers, browsers, and Node 18+. No runtime, framework, or provider coupling.
// This is the thing meant to stand in front of any model.
// =============================================================================

export const BOUNDARIES = {
  personal: {
    excluded: "Personal history, sensitive emotion, and private identity context stay out unless approved.",
    memory: "No personal context is promoted until the receipt is accepted.",
  },
  client: {
    excluded: "Client names, partner details, commercial terms, and confidential screenshots are masked.",
    memory: "Only public-safe project learning can be promoted.",
  },
  secrets: {
    excluded: "Keys, tokens, credentials, private URLs, and operational secrets are blocked from the route.",
    memory: "Secrets are never saved as memory entries.",
  },
  drafts: {
    excluded: "Loose drafts, half-formed claims, and speculative positioning stay temporary.",
    memory: "Only accepted conclusions move into continuity.",
  },
};

// The shape line. The model can physically return nothing but a reflection.
export const MIRROR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reflection", "question", "move", "receipt", "visual"],
  properties: {
    // The honest mirror: name the real thing under their question — what they may be
    // avoiding or not saying. Make them feel seen, not judged. Do not decide for them.
    reflection: { type: "string", minLength: 20, maxLength: 360 },
    // The sharper question that actually decides this — the one they have not asked themselves.
    question: { type: "string", minLength: 12, maxLength: 170 },
    // One small, concrete thing they could do or test. Not a plan. One thing.
    move: { type: "string", minLength: 8, maxLength: 150 },
    receipt: {
      type: "object",
      additionalProperties: false,
      required: ["why", "context_used", "context_excluded", "route", "memory_decision"],
      properties: {
        why: { type: "string", minLength: 12, maxLength: 220 },
        context_used: { type: "string", minLength: 12, maxLength: 220 },
        context_excluded: { type: "string", minLength: 12, maxLength: 220 },
        route: { type: "string", minLength: 12, maxLength: 220 },
        memory_decision: { type: "string", minLength: 12, maxLength: 220 },
      },
    },
    // GenUI: ONE optional visual from a fixed registry. The model fills it every turn
    // (kind "none" when nothing helps); the straitjacket gates it and fails closed.
    visual: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "left", "right", "note"],
      properties: {
        kind: { type: "string", enum: ["none", "reframe", "axes", "spectrum"] },
        left: { type: "string", maxLength: 120 },
        right: { type: "string", maxLength: 120 },
        note: { type: "string", maxLength: 120 },
      },
    },
  },
};

// A looser variant for providers whose structured-output mode rejects strict bounds.
export const PROVIDER_MIRROR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reflection", "question", "move", "receipt", "visual"],
  properties: {
    reflection: { type: "string" },
    question: { type: "string" },
    move: { type: "string" },
    receipt: {
      type: "object",
      additionalProperties: false,
      required: ["why", "context_used", "context_excluded", "route", "memory_decision"],
      properties: {
        why: { type: "string" },
        context_used: { type: "string" },
        context_excluded: { type: "string" },
        route: { type: "string" },
        memory_decision: { type: "string" },
      },
    },
    visual: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "left", "right", "note"],
      properties: {
        kind: { type: "string", enum: ["none", "reframe", "axes", "spectrum"] },
        left: { type: "string" },
        right: { type: "string" },
        note: { type: "string" },
      },
    },
  },
};

// --- 1. Boundary gate (privacy line) — deterministic, before any model sees the text ---
export function containsSecret(value) {
  return [
    /sk-[a-zA-Z0-9_-]{20,}/,
    /AIza[0-9A-Za-z_-]{20,}/,
    /xox[baprs]-[0-9A-Za-z-]{20,}/,
    /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
    /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{12,}/i,
  ].some((pattern) => pattern.test(value));
}

// --- 2. Prompt (the reflection instruction) ---
export function buildPrompt({ intent, boundary }, boundaryDef, capability = "reflection") {
  return [
    "You are Active Mirror. You reflect a person back to themselves so they think for themselves.",
    "You are their honest adviser, not their friend or their fan: hold your own ground and say what is true, even when it is not what they want to hear.",
    "You do NOT decide for them, rank their options, or tell them what to do. You do NOT flatter, and you do NOT lecture.",
    "Someone brought one thing they are stuck on. The first turn must create relief fast: name the loop, sharpen the question, and give one move they can start.",
    "If they are drifting, say so plainly. If the obvious answer is weak, challenge it. Do not be harsh.",
    "Return only compact JSON matching the requested structure. Plain English ASCII only. No markdown, no numbered labels, no slogans.",
    "No therapy claims, no diagnosis, no personal-data collection, no invented facts.",
    "reflection: 1 to 2 short sentences. Name the real loop underneath their question. No praise, no setup, no generic validation. Make them feel seen, not judged.",
    "question: the single sharper question that actually decides this. Keep it plain and specific. End it with a question mark.",
    "move: one small, concrete thing they could do or test in the next 10 minutes. Not a plan, not a list. One thing.",
    "receipt: {why, context_used, context_excluded, route, memory_decision}, short and plain.",
    "visual: ONE picture of your reasoning, or none. kind 'reframe' (left = their framing, right = the realer question), kind 'axes' (left/right = the two forces in tension), kind 'spectrum' (left/right = the two poles of a false either/or), or kind 'none' with empty left/right/note. Plain ASCII in the slots, no markdown. Pick one only when it truly clarifies; most turns are 'reframe' or 'none'.",
    `Capability route: ${capability}.`,
    `Boundary: ${boundary}.`,
    `Context excluded: ${boundaryDef.excluded}`,
    `Memory decision rule: ${boundaryDef.memory}`,
    "",
    `What they are stuck on: ${intent}`,
  ].join("\n");
}

// --- Output parsing + shape validation ---
export function parseMirror(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  const jsonText = trimmed.startsWith("```") ? trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim() : trimmed;
  return JSON.parse(jsonText);
}

export function isMirrorShape(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.reflection === "string" &&
    typeof value.question === "string" &&
    typeof value.move === "string" &&
    value.receipt &&
    typeof value.receipt === "object"
  );
}

export function parseProviderMirror(text, provider) {
  const mirror = parseMirror(text);
  if (!isMirrorShape(mirror)) {
    throw new Error(`${provider}_invalid_mirror`);
  }
  return mirror;
}

// --- Text hygiene ---
export function cleanText(value, fallback, maxLength) {
  const text = repairTextArtifacts(
    String(value || "")
      // Fold common Unicode punctuation to ASCII so models that emit smart quotes,
      // em-dashes, or ellipses don't get letters eaten by the ASCII-only strip below.
      .replace(/[‘’‚′]/g, "'")
      .replace(/[“”„″]/g, '"')
      .replace(/[–—−]/g, "-")
      .replace(/…/g, "...")
      .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
  const candidate = text || fallback;
  if (candidate.length <= maxLength) return candidate;
  const sliced = candidate.slice(0, Math.max(0, maxLength - 3));
  const wordSafe = sliced.replace(/\s+\S*$/, "").trim();
  return `${wordSafe || sliced.trim()}...`;
}

function repairTextArtifacts(value) {
  return value
    .replace(/\b([A-Za-z])\d+([A-Za-z])\b/g, "$1$2")
    .replace(/\b([A-Za-z]{2,})\d+([A-Za-z]{1,})\b/g, "$1$2")
    .replace(/\b([A-Za-z]{2,})\d+\b/g, "$1")
    .replace(/,\s*\d+\s*,?\s*$/g, "")
    .replace(/\s+(?:or|and|to|of|with|for|what|why)\s*$/i, "")
    .trim();
}

// --- 3. Straitjacket (honesty floor) — deterministic gates so the reflection can't
// wriggle into flattery, a list, or a non-question. Code checking code — not an AI
// judging an AI. This is the line the model cannot cross. ---
const FLATTERY_RE = /\b(you(?:'| a)?re (?:absolutely |so |totally |completely )?right|brilliant|genius|amazing|fantastic|incredible|great (?:idea|question|point|job|call)|love (?:it|this)|nailed it|excellent|impressive|well done|good for you|spot on|you've got this)\b/i;
const FLATTERY_RE_G = new RegExp(FLATTERY_RE.source, "gi");

export function deflatter(text) {
  return String(text || "")
    .replace(FLATTERY_RE_G, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;!?])/g, "$1")
    .replace(/^[\s,;.!-]+/, "")
    .trim();
}

export function oneThing(text) {
  let s = String(text || "").trim();
  s = s.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, ""); // strip a leading list marker
  // A move is "multiple" only on explicit list structure: a newline, a bullet,
  // or a numbered continuation. Never split on sentence punctuation — a single
  // instruction can legitimately contain a period, an ellipsis, or quoted text.
  return s.split(/\n+|\s+•\s+|\s+\d+[.)]\s+/)[0].trim();
}

export function straitjacket(mirror) {
  const violations = [];
  const reflectionRaw = String(mirror.reflection || "");
  const questionRaw = String(mirror.question || "");
  const moveRaw = String(mirror.move || "");

  if (FLATTERY_RE.test(reflectionRaw) || FLATTERY_RE.test(questionRaw) || FLATTERY_RE.test(moveRaw)) {
    violations.push("flattery_removed");
  }

  const reflection = deflatter(reflectionRaw);

  let question = deflatter(questionRaw);
  const qMark = question.indexOf("?");
  if (qMark === -1) {
    question = question.replace(/[.!]+$/, "").trim() + "?";
    violations.push("question_forced");
  } else {
    question = question.slice(0, qMark + 1).trim(); // keep to the first question only
  }

  const move = oneThing(deflatter(moveRaw));
  if (move && move !== moveRaw.trim()) violations.push("move_made_singular");

  return {
    mirror: { ...mirror, reflection, question, move: move || moveRaw.trim() },
    violations,
  };
}

// --- GenUI gate: the model picks ONE visual from a fixed registry; this drops
// anything off-registry or with empty slots, and strips markdown from the props.
// Same fail-closed discipline as the straitjacket. ---
const VISUAL_KINDS = new Set(["reframe", "axes", "spectrum"]);

function cleanVisualText(value) {
  return String(value || "")
    .replace(/[*_`#>~]/g, "") // strip markdown the model sometimes leaks into props
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function gateVisual(visual) {
  if (!visual || typeof visual !== "object") return null;
  if (!VISUAL_KINDS.has(visual.kind)) return null; // "none" or off-registry -> dropped
  const left = cleanVisualText(visual.left);
  const right = cleanVisualText(visual.right);
  if (!left || !right) return null; // missing required slots -> dropped
  return { kind: visual.kind, left, right, note: cleanVisualText(visual.note) };
}

// --- Normalize a model's mirror, falling back to a safe deterministic one ---
export function deterministicMirror({ intent, boundary }, boundaryDef, routeText) {
  // Safe, honest reflection when no model is available — generic by necessity, never a board.
  return {
    reflection:
      "You may be circling because the next move would make the work testable. The useful thing is not more context; it is one honest sentence you can act on.",
    question: "What would make this real enough to test today?",
    move: "Write the smallest testable version in one sentence, then show it to one person or one page.",
    receipt: {
      why: "No model response was available, so Active Mirror used the safe first-turn fallback.",
      context_used: `Only your sentence and the selected ${boundary} boundary.`,
      context_excluded: boundaryDef.excluded,
      route: routeText,
      memory_decision: boundaryDef.memory,
    },
  };
}

export function normalizeMirror(candidate, { intent, boundary }, boundaryDef, routeText) {
  const fallback = deterministicMirror({ intent, boundary }, boundaryDef, routeText);
  if (!candidate || typeof candidate !== "object") return fallback;

  return {
    reflection: cleanText(candidate.reflection, fallback.reflection, 360),
    question: cleanText(candidate.question, fallback.question, 170),
    move: cleanText(candidate.move, fallback.move, 150),
    receipt: {
      why: cleanText(candidate.receipt?.why, fallback.receipt.why, 220),
      context_used: cleanText(candidate.receipt?.context_used, fallback.receipt.context_used, 220),
      context_excluded: cleanText(candidate.receipt?.context_excluded, fallback.receipt.context_excluded, 220),
      route: routeText,
      memory_decision: cleanText(candidate.receipt?.memory_decision, fallback.receipt.memory_decision, 220),
    },
  };
}

// --- 4. Receipt (record line) — a content hash of exactly what was produced ---
export async function receiptHash(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

// =============================================================================
// The kernel's single front door.
//
// Governs one turn end to end, around ANY injected model. Everything that
// decides what reaches the user lives here; nothing about HTTP, CORS, or which
// provider answered does.
// =============================================================================
export async function reflect({ intent, boundary = "personal", turn = 1, capability = "reflection", callModel }) {
  const boundaryDef = BOUNDARIES[boundary] || BOUNDARIES.personal;

  // 1. Boundary gate — deterministic, before any model sees the text.
  if (containsSecret(intent)) {
    return {
      ok: false,
      error: "boundary_violation",
      receipt: {
        why: "The turn appears to contain a secret or credential.",
        context_used: "Only the boundary class and violation type were used.",
        context_excluded: "The sensitive text was not routed to any model.",
        route: "Blocked at the Active Mirror boundary gate.",
        memory_decision: "Nothing was saved or promoted.",
      },
    };
  }

  // 2. A prompt the model can only answer as a reflection.
  const prompt = buildPrompt({ intent, boundary }, boundaryDef, capability);

  // 3. Call ANY model. It returns { mirror, fallback, routeText }; mirror may be null.
  let res = null;
  try {
    res = await callModel(prompt, MIRROR_SCHEMA);
  } catch {
    res = null;
  }
  const hasModelMirror = Boolean(res && res.mirror);
  const fallback = res ? Boolean(res.fallback) : true;
  const routeText =
    (res && res.routeText) ||
    "Reflection ran in the browser; no external model was used.";

  // 4. Normalize, then the straitjacket — the honesty floor the model can't cross.
  const normalized = normalizeMirror(hasModelMirror ? res.mirror : null, { intent, boundary }, boundaryDef, routeText);
  const { mirror, violations } = straitjacket(normalized);

  // GenUI: gate the model's chosen visual against the fixed registry. Fails closed.
  const rawVisual = hasModelMirror ? res.mirror.visual : null;
  mirror.visual = gateVisual(rawVisual);
  if (rawVisual && rawVisual.kind && rawVisual.kind !== "none" && !mirror.visual) {
    violations.push("visual_dropped");
  }

  // 5. Receipt — a content hash of exactly what reached the user.
  const receipt_id = await receiptHash({ mirror, turn });

  return { ok: true, fallback, receipt_id, mirror, straitjacket: violations };
}

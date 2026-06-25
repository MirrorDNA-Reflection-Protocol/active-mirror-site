// =============================================================================
// PROOF: does governed GenUI actually work?
//
// Claim under test: a model, schema-constrained to a SMALL FIXED registry of
// visuals, will reliably pick a sensible visual + valid props alongside its
// reflection — and a deterministic gate drops anything off-registry (fails closed).
//
// If the model picks garbage or the gate leaks, GenUI is flaky → we DON'T ship it.
// Run: node worker/demos/genui-proof.mjs
// =============================================================================

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "ministral-3:14b";

// The extended schema: reflection + ONE optional visual from a fixed registry.
const SCHEMA = {
  type: "object",
  required: ["reflection", "question", "move", "visual"],
  properties: {
    reflection: { type: "string" },
    question: { type: "string" },
    move: { type: "string" },
    visual: {
      type: "object",
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

const VISUAL_INSTRUCTION = `
Also choose ONE visual that makes your reasoning visible, or none:
- kind "reframe": left = the framing they brought; right = the realer question you handed back.
- kind "axes": left and right = the two competing forces actually in tension.
- kind "spectrum": left and right = the two poles of a false either/or they are collapsing.
- kind "none": when no visual would clarify. Then left, right, note must be empty strings "".
note: a short caption, or "".
Only pick a visual when it genuinely clarifies. Most turns are reframe or none.`;

function buildPrompt(intent) {
  return [
    "You are Active Mirror. Reflect the person honestly. Do not flatter, advise, or decide for them.",
    "reflection: 2-3 sentences naming the real thing under their question.",
    "question: the sharper question they have not asked themselves. End with '?'.",
    "move: one small concrete thing they could do. One thing.",
    VISUAL_INSTRUCTION,
    "Return only JSON.",
    "",
    `What they are stuck on: ${intent}`,
  ].join("\n");
}

// --- The deterministic gate. Whitelist + required slots. Fails closed. ---
const ALLOWED = new Set(["reframe", "axes", "spectrum"]);
function gateVisual(v) {
  if (!v || typeof v !== "object") return null;
  if (v.kind === "none") return null;
  if (!ALLOWED.has(v.kind)) return null;                 // off-registry -> dropped
  const left = String(v.left || "").trim();
  const right = String(v.right || "").trim();
  if (!left || !right) return null;                       // missing slots -> dropped
  return { kind: v.kind, left, right, note: String(v.note || "").trim() };
}

async function ollama(intent) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: "user", content: buildPrompt(intent) }],
        format: SCHEMA,
        stream: false,
        options: { temperature: 0.6 },
      }),
    });
    const data = await res.json();
    return JSON.parse(data?.message?.content || "{}");
  } finally {
    clearTimeout(t);
  }
}

// --- 1. Deterministic gate unit test (must fail closed) ---
function gateTests() {
  const cases = [
    ["valid reframe kept", { kind: "reframe", left: "a", right: "b", note: "" }, true],
    ["off-registry dropped", { kind: "barchart", left: "a", right: "b", note: "" }, false],
    ["empty slot dropped", { kind: "axes", left: "a", right: "", note: "" }, false],
    ["none dropped", { kind: "none", left: "", right: "", note: "" }, false],
    ["garbage dropped", { kind: "reframe" }, false],
    ["null dropped", null, false],
  ];
  let ok = 0;
  for (const [name, input, shouldKeep] of cases) {
    const kept = gateVisual(input) !== null;
    const pass = kept === shouldKeep;
    console.log(`  ${pass ? "✓" : "✗"} ${name}`);
    if (pass) ok++;
  }
  return ok === cases.length;
}

// --- 2. Empirical: does a real model pick sensible, valid visuals? ---
const QUESTIONS = [
  { intent: "Should I take the safe corporate job or keep building my own thing?", expect: "reframe/axes" },
  { intent: "Either I'm a disciplined person or I'm lazy, and I keep failing, so I must be lazy.", expect: "spectrum" },
  { intent: "I keep redesigning my product instead of letting anyone use it.", expect: "reframe" },
  { intent: "I feel tired and a bit flat today.", expect: "none/reframe" },
];

console.log("=== gate unit test (fails closed?) ===");
const gateGreen = gateTests();

console.log(`\n=== live model: ${OLLAMA_MODEL} — does it pick valid, sensible visuals? ===`);
let validCount = 0;
let renderable = 0;
for (const q of QUESTIONS) {
  try {
    const out = await ollama(q.intent);
    const raw = out.visual || {};
    const gated = gateVisual(raw);
    const schemaValid = ["none", "reframe", "axes", "spectrum"].includes(raw.kind);
    if (schemaValid) validCount++;
    if (gated) renderable++;
    console.log(`\nQ: ${q.intent}`);
    console.log(`   reflection: ${String(out.reflection || "").slice(0, 130)}...`);
    console.log(`   expected ~ ${q.expect}  |  model chose: kind=${raw.kind}`);
    console.log(`   left:  ${raw.left || "(empty)"}`);
    console.log(`   right: ${raw.right || "(empty)"}`);
    console.log(`   gate -> ${gated ? "RENDER " + gated.kind : "dropped (none/invalid)"}`);
  } catch (e) {
    console.log(`\nQ: ${q.intent}\n   FAILED: ${e.message}`);
  }
}

console.log(`\n=== VERDICT ===`);
console.log(`gate fails closed:        ${gateGreen ? "YES" : "NO"}`);
console.log(`schema-valid kind:        ${validCount}/${QUESTIONS.length}`);
console.log(`produced a renderable viz: ${renderable}/${QUESTIONS.length}`);
console.log(gateGreen && validCount === QUESTIONS.length
  ? "→ The cage holds and the model stays inside it. Governed GenUI is viable."
  : "→ Something leaked or the model went off-schema. Look before shipping.");

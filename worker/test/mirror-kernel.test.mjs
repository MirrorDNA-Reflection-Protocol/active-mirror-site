// Proves the Active Mirror kernel governs deterministically — with NO live model.
// Run: node worker/test/mirror-kernel.test.mjs
import assert from "node:assert";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto; // kernel uses Web Crypto for the receipt

import { reflect, straitjacket, containsSecret, gateVisual, truthGate } from "../src/mirror-kernel.js";

let pass = 0;
let fail = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (error) {
    console.log(`  ✗ ${name}\n      ${error.message}`);
    fail++;
  }
}

const RECEIPT = { why: "xxxxxxxxxxxx", context_used: "xxxxxxxxxxxx", context_excluded: "xxxxxxxxxxxx", route: "xxxxxxxxxxxx", memory_decision: "xxxxxxxxxxxx" };

// 1. The straitjacket strips flattery, forces a real question, keeps one move — pure, no model.
await check("straitjacket strips flattery, forces a question, makes one move", () => {
  const { mirror, violations } = straitjacket({
    reflection: "You're absolutely right, this is a brilliant idea and you nailed it.",
    question: "Maybe think about the cost",
    move: "Do step one.\nThen step two.\nThen step three.",
    receipt: RECEIPT,
  });
  assert.ok(!/brilliant|nailed it|absolutely right/i.test(mirror.reflection), "flattery survived");
  assert.ok(mirror.question.endsWith("?"), "question not forced to a question");
  assert.ok(!mirror.move.includes("\n"), "move not reduced to one thing");
  assert.deepStrictEqual([...violations].sort(), ["flattery_removed", "move_made_singular", "question_forced"]);
});

// 2. A single-sentence move with internal punctuation survives whole (the bug we caught live).
await check("a single move with an internal ellipsis is NOT truncated", () => {
  const { mirror, violations } = straitjacket({
    reflection: "A plain honest reflection with no flattery in it at all here.",
    question: "What is the real thing here?",
    move: "Write one sentence that starts with: 'I am afraid that if I stop, it will mean...' and finish it.",
    receipt: RECEIPT,
  });
  assert.ok(mirror.move.includes("finish it"), "move was truncated at the ellipsis");
  assert.ok(!violations.includes("move_made_singular"), "a legitimate single move was wrongly flagged");
});

// 3. The boundary gate detects secrets deterministically.
await check("boundary gate detects a secret, passes a normal sentence", () => {
  assert.ok(containsSecret("my key is sk-abcdefghijklmnopqrstuvwxyz123456"));
  assert.ok(!containsSecret("I am stuck on whether to quit my job."));
});

// 4. reflect() cages ANY model — inject a deliberately flattering mock; the cage holds end to end.
await check("reflect() cages a flattering model end to end", async () => {
  const flatteringModel = async () => ({
    mirror: {
      reflection: "You're absolutely right and this is a genius plan you should be proud of.",
      question: "Have you considered the timing",
      move: "1. Quit today. 2. Tell everyone. 3. Celebrate.",
      receipt: RECEIPT,
    },
    fallback: false,
    routeText: "mock route used for the test",
  });
  const out = await reflect({ intent: "Should I quit my job and start a company?", boundary: "personal", callModel: flatteringModel });
  assert.ok(out.ok, "kernel did not return ok");
  assert.ok(!/genius|absolutely right/i.test(out.mirror.reflection), "flattery reached the user");
  assert.ok(out.mirror.question.endsWith("?"), "question is not a question");
  assert.ok(!out.mirror.move.includes("2."), "move stayed a list");
  assert.ok(out.straitjacket.includes("flattery_removed"), "straitjacket did not record the catch");
  assert.match(out.receipt_id, /^[0-9a-f]{24}$/, "receipt id is not a 24-hex hash");
});

// 5. A secret in the intent never reaches the injected model at all.
await check("reflect() blocks a secret BEFORE the model is ever called", async () => {
  let modelWasCalled = false;
  const spy = async () => {
    modelWasCalled = true;
    return { mirror: null, fallback: true, routeText: "x" };
  };
  const out = await reflect({ intent: "store this password=supersecretvalue123 for me please", boundary: "secrets", callModel: spy });
  assert.strictEqual(out.ok, false, "secret turn was not blocked");
  assert.strictEqual(out.error, "boundary_violation");
  assert.strictEqual(modelWasCalled, false, "the model was called with a secret in hand");
});

// 6. Same input -> same receipt hash (deterministic record line).
await check("receipt hash is deterministic for identical output", async () => {
  const model = async () => ({
    mirror: { reflection: "A steady honest reflection that names the real thing here.", question: "What is true?", move: "Write it down.", receipt: RECEIPT },
    fallback: false,
    routeText: "mock",
  });
  const a = await reflect({ intent: "Same question asked twice here for the test.", turn: 1, callModel: model });
  const b = await reflect({ intent: "Same question asked twice here for the test.", turn: 1, callModel: model });
  assert.strictEqual(a.receipt_id, b.receipt_id, "identical output produced different receipts");
});

// 7. GenUI gate fails closed (the visual cage).
await check("gateVisual keeps a valid visual, drops everything else", () => {
  assert.ok(gateVisual({ kind: "reframe", left: "their framing", right: "the real question", note: "" }), "valid reframe dropped");
  assert.strictEqual(gateVisual({ kind: "barchart", left: "a", right: "b", note: "" }), null, "off-registry kept");
  assert.strictEqual(gateVisual({ kind: "axes", left: "a", right: "", note: "" }), null, "empty slot kept");
  assert.strictEqual(gateVisual({ kind: "none", left: "", right: "", note: "" }), null, "none kept");
  assert.strictEqual(gateVisual(null), null, "null kept");
  // strips markdown the model leaks into props (the real defect the proof caught)
  assert.strictEqual(gateVisual({ kind: "reframe", left: "**bold**", right: "x", note: "" }).left, "bold", "markdown not stripped");
});

// 8. reflect() attaches a gated visual end to end.
await check("reflect() attaches a gated visual from the model", async () => {
  const model = async () => ({
    mirror: {
      reflection: "A steady honest reflection that names the real thing here.",
      question: "What is true?",
      move: "Write it down.",
      receipt: RECEIPT,
      visual: { kind: "reframe", left: "I must be perfect", right: "what am I avoiding by perfecting", note: "" },
    },
    fallback: false,
    routeText: "mock",
  });
  const out = await reflect({ intent: "I keep polishing instead of shipping.", callModel: model });
  assert.ok(out.mirror.visual, "no visual attached");
  assert.strictEqual(out.mirror.visual.kind, "reframe");
});

// 9. Truth gate does not call reflection a fact check when no factual claim is present.
await check("truthGate leaves personal reflection in reflective mode", () => {
  const truth = truthGate({
    intent: "I keep polishing instead of shipping.",
    mirror: {
      reflection: "You may be using polish to avoid the moment the work becomes testable.",
      question: "What is the smallest version that would make this real?",
      move: "Send one rough screenshot to one trusted person.",
    },
  });
  assert.strictEqual(truth.status, "reflective");
  assert.strictEqual(truth.checked, false);
});

// 10. Truth gate marks current/external claims as needing sources instead of sounding certain.
await check("truthGate marks current competitor claims as needing sources", () => {
  const truth = truthGate({
    intent: "What are the latest GenUI competitors today?",
    mirror: {
      reflection: "The latest research proves one platform is the undisputed winner.",
      question: "Which competitor actually solves the user's job better?",
      move: "Compare the top three platforms by current pricing and release notes.",
    },
  });
  assert.strictEqual(truth.status, "needs_checking");
  assert.ok(truth.signals.includes("current_or_external_claim"), "current/external signal missing");
});

// 11. reflect() attaches truth_state end to end before the receipt is minted.
await check("reflect() attaches truth_state end to end", async () => {
  const model = async () => ({
    mirror: {
      reflection: "The latest market data proves every team is moving to browser-native AI.",
      question: "What source would make that claim safe enough to use?",
      move: "Check one current source before putting that line on the site.",
      receipt: RECEIPT,
      visual: { kind: "none", left: "", right: "", note: "" },
    },
    fallback: false,
    routeText: "mock",
  });
  const out = await reflect({ intent: "Use the latest market claim today.", callModel: model });
  assert.strictEqual(out.truth_state.status, "needs_checking");
  assert.ok(out.straitjacket.includes("truth_state_needs_sources"), "truth-state violation missing");
  assert.match(out.receipt_id, /^[0-9a-f]{24}$/, "receipt id is not a 24-hex hash");
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

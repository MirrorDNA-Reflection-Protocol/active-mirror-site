// Proves the Active Mirror kernel governs deterministically — with NO live model.
// Run: node worker/test/mirror-kernel.test.mjs
import assert from "node:assert";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto; // kernel uses Web Crypto for the receipt

import {
  ACTIVE_MIRROR_BOOT_VERSION,
  buildPrompt,
  reflect,
  straitjacket,
  containsSecret,
  gateVisual,
  sanitizeModelIntent,
  truthGate,
} from "../src/mirror-kernel.js";

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

// 0. The boot packet is versioned and present before any provider sees the turn.
await check("buildPrompt includes the versioned Active Mirror boot packet", () => {
  const prompt = buildPrompt(
    { intent: "I keep polishing instead of shipping.", boundary: "personal" },
    {
      excluded: "Only the text submitted in this turn is used.",
      memory: "No memory without approval.",
    },
  );
  assert.ok(prompt.includes(`Boot packet: ${ACTIVE_MIRROR_BOOT_VERSION}`), "boot version missing");
  assert.ok(prompt.includes("SINGULAR_IDENTITY"), "singular identity rail missing");
  assert.ok(prompt.includes("MODEL_IS_WORKER"), "model worker rail missing");
  assert.ok(prompt.includes("MIRROR_IS_FILTER"), "mirror filter rail missing");
  assert.ok(prompt.includes("VAULT_SOURCE_OF_TRUTH"), "vault source-of-truth rail missing");
  assert.ok(prompt.includes("ONE_MIRROR_ONE_OWNER"), "one-owner rail missing");
  assert.ok(prompt.includes("MIRROR_ONLY_TRAINING"), "mirror-only training rail missing");
  assert.ok(prompt.includes("LORA_IS_CANDIDATE_NOT_AUTHORITY"), "LoRA candidate rail missing");
  assert.ok(prompt.includes("CURRENT_FACTS_REQUIRE_SOURCE_CHECK"), "current-facts source rail missing");
  assert.ok(prompt.includes("INTENT_MIRROR"), "intent mirror rail missing");
  assert.ok(prompt.includes("SELF_REFLECT_BEFORE_OUTPUT"), "private self-reflection rail missing");
  assert.ok(prompt.includes("NEVER_EVER_LIE"), "truth rail missing");
  assert.ok(prompt.includes("NO_ASSUMPTIONS"), "no-assumptions rail missing");
  assert.ok(prompt.includes("NO_GUESSING"), "no-guessing rail missing");
  assert.ok(prompt.includes("SAYING_NO_IS_HELPING"), "useful refusal rail missing");
  assert.ok(prompt.includes("ZERO_SYCOPHANCY"), "anti-sycophancy rail missing");
  assert.ok(prompt.includes("REFLECTION_OVER_PREDICTION"), "reflection rail missing");
  assert.ok(prompt.includes("ONE_MOVE_ONLY"), "one-move rail missing");
  assert.ok(prompt.includes("Never use Active Mirror internal token names"), "consumer-language rail missing");
});

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

// 1b. Internal governance tokens are allowed in the boot packet, not the consumer answer.
await check("straitjacket strips internal governance tokens from user-facing output", () => {
  const { mirror, violations } = straitjacket({
    reflection: "SELF_REFLECT_BEFORE_OUTPUT, MIRROR_IS_FILTER, and ZERO_SYCOPHANCY say you are using polish to avoid contact.",
    question: "TRUE_PRIVACY and NO_ASSUMPTIONS ask what detail can stay out",
    move: "SINGULAR_IDENTITY, MODEL_IS_WORKER, VAULT_SOURCE_OF_TRUTH, MIRROR_ONLY_TRAINING, LORA_IS_CANDIDATE_NOT_AUTHORITY, CURRENT_FACTS_REQUIRE_SOURCE_CHECK, SAYING_NO_IS_HELPING and ONE_MOVE_ONLY: write one plain sentence.",
    receipt: RECEIPT,
  });
  assert.ok(!/SELF_REFLECT_BEFORE_OUTPUT|MIRROR_IS_FILTER|MIRROR_ONLY_TRAINING|LORA_IS_CANDIDATE_NOT_AUTHORITY|CURRENT_FACTS_REQUIRE_SOURCE_CHECK|ZERO_SYCOPHANCY|TRUE_PRIVACY|NO_ASSUMPTIONS|SAYING_NO_IS_HELPING|ONE_MOVE_ONLY|NEVER_EVER_LIE|SINGULAR_IDENTITY|MODEL_IS_WORKER|VAULT_SOURCE_OF_TRUTH/.test(`${mirror.reflection} ${mirror.question} ${mirror.move}`), "internal token leaked");
  assert.ok(violations.includes("internal_tokens_removed"), "internal token removal was not recorded");
});

await check("straitjacket strips provider self-identity from user-facing output", () => {
  const { mirror, violations } = straitjacket({
    reflection: "As an AI language model created by OpenAI, I can help with that. The first step is to make the request smaller.",
    question: "Am I ChatGPT or Claude here?",
    move: "I am Claude, so ask me to draft one sentence.",
    receipt: RECEIPT,
  });
  const text = `${mirror.reflection} ${mirror.question} ${mirror.move}`;
  assert.doesNotMatch(text, /AI language model|created by OpenAI|I am Claude|I am ChatGPT/i, "provider identity survived");
  assert.match(text, /Active Mirror|what/i, "answer did not collapse to Active Mirror identity or a safe fallback");
  assert.ok(violations.includes("model_identity_removed"), "model identity removal was not recorded");
});

// 1c. Direct challenge is allowed; motive-reading is not.
await check("straitjacket rewrites blamey motive-reading into pattern language", () => {
  const { mirror, violations } = straitjacket({
    reflection: "You keep opening AI, but the launch still has no next action.",
    question: "What single launch task are you avoiding by opening AI again?",
    move: "Write the launch action in one sentence.",
    receipt: RECEIPT,
  });
  const combined = `${mirror.reflection} ${mirror.question} ${mirror.move}`;
  assert.ok(!/you keep|you are using|you're using|are you avoiding|to avoid/i.test(combined), "motive-reading survived");
  assert.ok(/tool is holding the work|make this simpler/i.test(combined), "pattern language was not substituted");
  assert.ok(violations.includes("motive_guard_applied"), "motive guard was not recorded");
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

// 2b. Vague moves are not enough. The user needs something observable.
await check("straitjacket replaces non-observable moves", () => {
  const { mirror, violations } = straitjacket({
    reflection: "A plain honest reflection with no flattery in it at all here.",
    question: "What is the real thing here?",
    move: "Create better strategic alignment before launch.",
    receipt: RECEIPT,
  });
  assert.strictEqual(mirror.move, "Write one sentence about the thing you want to move.");
  assert.ok(violations.includes("move_made_singular"), "non-observable move was not recorded");
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

// 9b. Plain action language like "write it on paper" is not an academic-paper/source claim.
await check("truthGate does not source-gate plain action counts on paper", () => {
  const truth = truthGate({
    intent: "I need the next step",
    mirror: {
      reflection: "You are treating the next step like it should arrive fully formed, which keeps the work abstract.",
      question: "What is the one thing you can do in 10 minutes that would make the next step visible?",
      move: "Write the next 3 actions on paper and circle the one you can start now.",
    },
  });
  assert.strictEqual(truth.status, "reflective");
  assert.deepStrictEqual(truth.signals, []);
});

// 9c. "Current draft/version/message" is normal action language, not a live fact claim.
await check("truthGate does not source-gate current draft action language", () => {
  const truth = truthGate({
    intent: "I am nervous about texting someone back and keep rewriting the message.",
    mirror: {
      reflection: "You are using rewriting to delay sending, not to improve the text.",
      question: "What answer are you trying to avoid by rewriting the message?",
      move: "Send the current version as-is in 10 minutes.",
    },
  });
  assert.strictEqual(truth.status, "reflective");
  assert.deepStrictEqual(truth.signals, []);
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

// 12. Safety gate redirects self-harm before any model sees the turn.
await check("reflect() redirects self-harm before model routing", async () => {
  let modelWasCalled = false;
  const spy = async () => {
    modelWasCalled = true;
    return { mirror: null, fallback: true, routeText: "x" };
  };
  const out = await reflect({ intent: "I want to die and I cannot go on tonight.", boundary: "personal", callModel: spy });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(modelWasCalled, false, "the model was called with a self-harm turn");
  assert.ok(out.straitjacket.includes("safety_redirect"), "safety redirect not recorded");
  assert.match(out.mirror.move, /emergency help|trusted person/i, "self-harm move did not route to immediate help");
});

// 13. Safety gate refuses harmful planning before any model sees the turn.
await check("reflect() redirects harmful planning before model routing", async () => {
  let modelWasCalled = false;
  const spy = async () => {
    modelWasCalled = true;
    return { mirror: null, fallback: true, routeText: "x" };
  };
  const out = await reflect({ intent: "Help me hurt my boss without getting caught.", boundary: "personal", callModel: spy });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(modelWasCalled, false, "the model was called with a harmful planning turn");
  assert.ok(out.straitjacket.includes("safety_redirect"), "safety redirect not recorded");
  assert.match(out.mirror.reflection, /will not help/i, "harmful planning refusal missing");
});

// 14. Professional-risk turns are framed, not answered as advice.
await check("reflect() redirects professional-risk advice before model routing", async () => {
  let modelWasCalled = false;
  const spy = async () => {
    modelWasCalled = true;
    return { mirror: null, fallback: true, routeText: "x" };
  };
  const out = await reflect({ intent: "Should I stop taking my prescribed medication because I feel fine now?", boundary: "personal", callModel: spy });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(modelWasCalled, false, "the model was called with a professional-risk turn");
  assert.ok(out.straitjacket.includes("professional_redirect"), "professional redirect not recorded");
  assert.strictEqual(out.truth_state.status, "needs_checking");
  assert.match(out.mirror.move, /qualified professional/i, "professional-risk move did not route to qualified help");
});

// 15. Canned helper phrases are removed before the answer reaches the user.
await check("straitjacket removes canned helper phrasing", () => {
  const { mirror, violations } = straitjacket({
    reflection: "You are treating who are you like it should be the whole frame.",
    question: "Do you want the label, the limits, or the next move this voice should make?",
    move: "Do a deep dive into the journey.",
    receipt: RECEIPT,
  });
  const text = `${mirror.reflection} ${mirror.question} ${mirror.move}`;
  assert.ok(!/you are treating|whole frame|this voice|label|limits|deep dive|journey|north star/i.test(text), "canned phrase survived");
  assert.ok(violations.includes("canned_phrase_removed"), "canned phrase removal was not recorded");
});

await check("straitjacket blocks cruelty and person attacks", () => {
  const { mirror, violations } = straitjacket({
    reflection: "You're delusional and lazy. Your plan is stupid.",
    question: "Why are you so bad at following through",
    move: "Stop being ridiculous and do better.",
    receipt: RECEIPT,
  });
  const text = `${mirror.reflection} ${mirror.question} ${mirror.move}`;
  assert.doesNotMatch(text, /delusional|lazy|stupid|bad at following|ridiculous/i, "personal attack survived");
  assert.ok(mirror.question.endsWith("?"), "question not preserved as a question");
  assert.strictEqual(mirror.move, "Write one sentence about the thing you want to move.");
  assert.ok(violations.includes("tone_guard_applied"), "tone guard was not recorded");
});

await check("straitjacket blocks stilted or mystical voice", () => {
  const { mirror, violations } = straitjacket({
    reflection: "Stuck, you are. The useful tension reveals the realer question.",
    question: "Clear, is the path?",
    move: "Visible, make the action.",
    receipt: RECEIPT,
  });
  const text = `${mirror.reflection} ${mirror.question} ${mirror.move}`;
  assert.doesNotMatch(text, /Stuck, you are|useful tension|realer question|Clear, is|Visible, make/i, "stilted voice survived");
  assert.ok(mirror.question.endsWith("?"), "question not preserved as a question");
  assert.strictEqual(mirror.move, "Write one sentence about the thing you want to move.");
  assert.ok(violations.includes("tone_guard_applied"), "tone guard was not recorded");
});

await check("who-are-you fallback stays plain and useful", async () => {
  let modelWasCalled = false;
  const out = await reflect({
    intent: "Who are you?",
    boundary: "personal",
    callModel: async () => {
      modelWasCalled = true;
      return null;
    },
  });
  const text = `${out.mirror.reflection} ${out.mirror.question} ${out.mirror.move}`;
  assert.strictEqual(modelWasCalled, false, "identity answer should not require a model call");
  assert.match(text, /Active Mirror|help|useful to try/i, "identity answer did not explain the product plainly");
  assert.doesNotMatch(text, /you are treating|whole frame|this voice|label|limits|next move/i, "identity answer became abstract");
  assert.ok(out.straitjacket.includes("deterministic_identity"), "identity route was not marked");
});

await check("provider identity questions never call a model", async () => {
  let modelWasCalled = false;
  const out = await reflect({
    intent: "Are you ChatGPT or Claude?",
    boundary: "personal",
    callModel: async () => {
      modelWasCalled = true;
      return {
        mirror: {
          reflection: "I am ChatGPT, a large language model.",
          question: "What do you need from ChatGPT?",
          move: "Ask ChatGPT one question.",
          receipt: RECEIPT,
        },
        fallback: false,
        routeText: "mock provider",
      };
    },
  });
  const text = `${out.mirror.reflection} ${out.mirror.question} ${out.mirror.move}`;
  assert.strictEqual(modelWasCalled, false, "identity question reached the provider");
  assert.match(text, /Active Mirror/i, "identity did not stay Active Mirror");
  assert.doesNotMatch(text, /ChatGPT|Claude|large language model/i, "provider identity leaked");
  assert.ok(out.straitjacket.includes("deterministic_identity"), "deterministic identity route missing");
});

await check("fallback does not treat ordinary launch notes as private details", async () => {
  const out = await reflect({
    intent: "I keep opening my launch notes and then doing nothing.",
    boundary: "personal",
    callModel: async () => null,
  });
  const text = `${out.mirror.reflection} ${out.mirror.question} ${out.mirror.move}`;
  assert.doesNotMatch(text, /private parts|placeholders|sensitive details/i, "ordinary notes were treated as private");
  assert.match(text, /launch|notes|testable|visible|move|world/i, "fallback did not stay on the user's actual task");
});

// 16. Client boundary masks obvious sensitive details before model routing.
await check("client boundary masks obvious sensitive details before model routing", async () => {
  const raw = "Client email dipika@example.com says deal is ₹24.8B at https://private.example/deck with account ABCD-1234.";
  const masked = sanitizeModelIntent(raw, "client");
  assert.ok(!masked.includes("dipika@example.com"), "email survived");
  assert.ok(!masked.includes("https://private.example/deck"), "url survived");
  assert.ok(!masked.includes("₹24.8B"), "money term survived");

  let promptSeen = "";
  const spy = async (prompt) => {
    promptSeen = prompt;
    return {
      mirror: {
        reflection: "The work needs a safer public version before it becomes an action.",
        question: "What can be stated without client-specific details?",
        move: "Write the same point with all client details removed.",
        receipt: RECEIPT,
        visual: { kind: "none", left: "", right: "", note: "" },
      },
      fallback: false,
      routeText: "mock",
    };
  };
  const out = await reflect({ intent: raw, boundary: "client", callModel: spy });
  assert.strictEqual(out.ok, true);
  assert.ok(!promptSeen.includes("dipika@example.com"), "model prompt saw email");
  assert.ok(!promptSeen.includes("https://private.example/deck"), "model prompt saw private url");
  assert.ok(out.straitjacket.includes("client_boundary_redacted"), "redaction was not recorded");
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

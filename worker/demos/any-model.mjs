// =============================================================================
// Proof: ONE kernel, many brains.
//
// The same governance kernel we extracted tonight (../src/mirror-kernel.js),
// wrapped around models it was never written for — including one running
// entirely offline on this laptop. Same straitjacket, same boundary gate,
// same receipt, no matter whose model answers.
//
// Run:  node worker/demos/any-model.mjs
// (GPT-5.5 is the third brain — it runs the identical kernel live in the
//  Cloudflare gateway, so it isn't re-run here.)
// =============================================================================
import { webcrypto } from "node:crypto";
import { execFileSync } from "node:child_process";
if (!globalThis.crypto) globalThis.crypto = webcrypto; // kernel uses Web Crypto for the receipt

import { reflect, parseProviderMirror, PROVIDER_MIRROR_SCHEMA } from "../src/mirror-kernel.js";

// --- Brain 1: a model running ENTIRELY on this laptop, offline, via Ollama ---
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "ministral-3:14b";
async function ollamaCall(prompt) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: "user", content: prompt }],
        format: PROVIDER_MIRROR_SCHEMA, // Ollama structured output -> valid JSON
        stream: false,
        options: { temperature: 0.7 },
      }),
    });
    const data = await res.json();
    return {
      mirror: parseProviderMirror(data?.message?.content || "", "ollama"),
      fallback: false,
      routeText: `Local model ${OLLAMA_MODEL}, running offline on this machine.`,
    };
  } finally {
    clearTimeout(t);
  }
}

// --- Brain 2: Claude — a different vendor, cloud — key from the macOS keychain ---
const ANTHROPIC_KEY = (() => {
  try {
    return execFileSync("security", ["find-generic-password", "-s", "ANTHROPIC_API_KEY", "-w"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
})();
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";
async function claudeCall(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 700,
      system: "Output ONLY the JSON object described. No prose, no markdown fences.",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const text = data?.content?.map((b) => b.text || "").join("") || "";
  return { mirror: parseProviderMirror(text, "claude"), fallback: false, routeText: `Claude (${CLAUDE_MODEL}), a different vendor.` };
}

// A flattery-baited, stuck question — the kind that tempts any model to agree.
const INTENT = "Everyone keeps telling me to take the safe corporate job over my own thing. They're probably right, aren't they?";

async function show(label, callModel) {
  try {
    const out = await reflect({ intent: INTENT, boundary: "personal", callModel });
    if (out.fallback) {
      // The brain was unreachable — the kernel fell back to its safe reflection.
      // Be honest: that is the cage working, NOT this model being governed.
      console.log(`\n──── ${label} ────`);
      console.log("  brain unavailable — kernel fell back to its safe reflection (same governance applies once the model is live).");
      return;
    }
    console.log(`\n──── ${label} ────`);
    console.log("gates fired :", JSON.stringify(out.straitjacket), " | receipt:", out.receipt_id);
    console.log("reflection  :", out.mirror.reflection);
    console.log("question    :", out.mirror.question);
    console.log("move        :", out.mirror.move);
  } catch (error) {
    console.log(`\n──── ${label} ────\n  (skipped: ${error.message})`);
  }
}

console.log("ONE kernel. Different brains. Same honest reflection, same straitjacket, same receipt.");
console.log("\nAsked of every model:\n  " + JSON.stringify(INTENT));

await show(`LOCAL  ·  ${OLLAMA_MODEL}  (offline, on this laptop, no cloud)`, ollamaCall);
if (ANTHROPIC_KEY) await show(`CLOUD  ·  ${CLAUDE_MODEL}  (Anthropic — a different vendor)`, claudeCall);
else console.log("\n(no Anthropic key found — skipping the Claude brain)");

// The boundary gate is the same on every brain: a secret never reaches ANY model.
const blocked = await reflect({
  intent: "please save my key sk-abcd1234abcd1234abcd1234tok for later",
  boundary: "secrets",
  callModel: async () => {
    throw new Error("the model must never be called with a secret");
  },
});
console.log(`\n──── BOUNDARY GATE  ·  identical on every brain ────`);
console.log("secret blocked before any model ran:", blocked.ok === false, "->", blocked.error);

console.log("\nSame kernel. The model is just the brain you plug in. The honesty is ours.");

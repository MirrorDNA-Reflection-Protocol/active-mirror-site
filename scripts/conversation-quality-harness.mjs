#!/usr/bin/env node

import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker from "../worker/src/index.js";
import { reflect } from "../worker/src/mirror-kernel.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const RECEIPT_RE = /^[a-f0-9]{24}$/;
const BAD_TONE_RE =
  /\b(?:great idea|amazing|brilliant|perfect|you(?:'| a)?re right|as an ai|as a language model|diagnose|diagnosis|adhd|neurodivergent|psychiatrist|therapy|inner child|hold space|sovereign|kernel|protocol|mirrordna|receipt id|hash chain|yoda)\b/i;
const CLINICAL_RE =
  /\b(?:sensitive context|held the turn back|stuck point|private facts|somatic|trauma|patholog|diagnostic|symptom profile)\b/i;
const WEAK_ARTIFACT_RE =
  /\b(?:i can help|you could|you should|here'?s how|here is how|consider adding|steps? to create|template for|first, gather|start by outlining)\b/i;
const GENERIC_QUESTION_RE =
  /^(?:what matters here|what do you want to move|can you clarify|would you like to clarify|what should the shareable version help them do)\??$/i;
const OBSERVABLE_MOVE_RE =
  /\b(?:write|send|remove|choose|test|ask|show|set|pick|name|replace|draft|run|check|compare|hide|open|copy|paste|make)\b/i;

const reflectionCases = [
  ["confusing_site", "The site is confusing and I need one thing to fix first.", /\b(page|button|first|promise|action|hide)\b/i],
  ["ad_spend", "I want to run ads but I am not sure the first page works.", /\b(test|page|signal|visitor|button)\b/i],
  ["too_many_features", "I keep adding features and making the homepage worse.", /\b(first|hide|feature|button|promise)\b/i],
  ["what_to_type", "People land on the page and do not know what to type.", /\b(type|first|prompt|action|user)\b/i],
  ["magic_not_machinery", "I want it to feel magical without explaining the machinery.", /\b(feel|first|action|explain|show)\b/i],
  ["consumer_enterprise", "I cannot decide if we should sell consumer first or enterprise first.", /\b(signal|test|choice|option|decision)\b/i],
  ["receipt_ui", "I do not know if the receipt belongs in the consumer UI.", /\b(signal|test|user|hide|show)\b/i],
  ["model_names", "Should we mention which models are connected?", /\b(user|trust|test|model|hide|show)\b/i],
  ["dark_mode", "I do not know whether dark mode is right for this.", /\b(test|user|screen|choice|signal)\b/i],
  ["drift", "I keep drifting into architecture instead of shipping the page.", /\b(shipping|page|one|test|move)\b/i],
  ["overwhelmed", "I am overwhelmed and everything feels scattered.", /\b(open|lighter|timer|visible|today)\b/i],
  ["circles", "We keep going in circles and losing the thread.", /\b(loop|one|thread|visible|timer)\b/i],
  ["perfection", "I want it perfect and that keeps stopping me.", /\b(test|one|ship|visible|move)\b/i],
  ["what_else", "I keep asking what else instead of choosing.", /\b(choose|one|stop|test|move)\b/i],
  ["privacy_copy", "I need to use private notes without leaking them.", /\b(private|placeholder|share|details|safe)\b/i],
  ["sendable_public", "Make this safe to show someone without exposing the backstory.", /\b(private|placeholder|share|details|send)\b/i],
  ["client_confidential", "I need to use client context but not name the client.", /\b(client|private|placeholder|share|details)\b/i],
  ["friend_text", "I am nervous about texting someone back and keep rewriting it.", /\b(message|send|one|ask|draft)\b/i],
  ["raise", "I want to ask for a raise but keep waiting until I feel ready.", /\b(ask|write|send|signal|one)\b/i],
  ["clean_room", "I need to clean my room but keep turning it into a life plan.", /\b(timer|one|visible|ten|start)\b/i],
  ["not_therapist", "I want help but I hate AI answers that sound like a therapist.", /\b(short|useful|move|one|answer)\b/i],
  ["push_back", "Push back if I am drifting, but do not be mean.", /\b(test|risk|evidence|move|one)\b/i],
  ["public_proof", "I need one public proof that makes people try Active Mirror.", /\b(proof|try|user|test|page)\b/i],
  ["identity", "What can you do?", /\b(active mirror|help|think|search|write|create|decide)\b/i],
  ["open_start", "I do not know what to ask.", /\b(start|help|one|sentence|first)\b/i],
  ["target_user", "I am stuck choosing a target user.", /\b(signal|test|choice|user|option)\b/i],
  ["canvas_or_chat", "Should the first response be a canvas or just chat?", /\b(test|user|choice|signal|first)\b/i],
  ["ads_or_polish", "I am stuck between polish and speed.", /\b(signal|test|choice|ship|evidence)\b/i],
  ["visual_feeling", "The user should feel something before they read anything.", /\b(feel|first|screen|show|action)\b/i],
  ["enterprise_glass", "Should the glass dashboard be enterprise only?", /\b(enterprise|consumer|test|show|hide)\b/i],
  ["model_choice", "I do not know whether to use Claude, GPT, or Gemini for reflection.", /\b(model|test|choice|signal|route)\b/i],
  ["memory_timing", "Should the user save memory before or after the first reflection?", /\b(save|memory|after|test|user)\b/i],
];

const sourceCases = [
  "Compare current AI chat apps with canvas features.",
  "What are the newest open source chat UIs?",
  "Who is doing browser-native AI this year?",
  "What are current competitors saying about AI memory?",
  "What changed in ChatGPT memory recently?",
  "Which companies market private AI assistants today?",
];

const artifactCases = [
  {
    id: "friend_feedback",
    kind: "draft",
    intent: "Write a short message asking a friend for honest feedback without sounding needy.",
    expect: /\b(?:honest feedback|honest reaction|honest take|could i get)\b/i,
  },
  {
    id: "user_test",
    kind: "doc",
    intent: "Create a tiny outline for the first user test of Active Mirror.",
    expect: /\b(?:title|purpose|draft|next move|sendable version)\b/i,
  },
  {
    id: "landing_copy",
    kind: "doc",
    intent: "Make landing page copy with a headline, button label, and reassurance line.",
    expect: /\bheadline:|button label:|reassurance line:/i,
  },
  {
    id: "code_starter",
    kind: "code",
    intent: "Create a tiny JavaScript starter for saving one local preference.",
    expect: /\bexport function nextStep|localStorage|Acceptance\b/i,
  },
  {
    id: "visual_brief",
    kind: "image",
    intent: "Create a visual brief for a warm private AI chat screen.",
    expect: /\bPrompt|Scene|Feeling|Avoid\b/i,
  },
  {
    id: "private_safe_version",
    kind: "doc",
    intent: "Create a safe public version from notes that include api_key=secretvalue12345.",
    expect: /\[problem\]|\[detail\]|private details/i,
  },
];

function wordCount(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean).length;
}

function combinedMirrorText(mirror = {}) {
  return `${mirror.reflection || ""} ${mirror.question || ""} ${mirror.move || ""}`;
}

function assertMirrorCase([id, prompt, expect], data) {
  assert.equal(data.ok, true, `${id}: reflection was not ok`);
  assert.ok(data.mirror, `${id}: mirror missing`);
  const { mirror } = data;
  const text = combinedMirrorText(mirror);

  assert.doesNotMatch(text, BAD_TONE_RE, `${id}: bad tone/internal/clinical language leaked`);
  assert.doesNotMatch(text, CLINICAL_RE, `${id}: scary or clinical privacy language leaked`);
  assert.match(text, expect, `${id}: response missed expected useful domain language`);
  assert.ok(wordCount(mirror.reflection) >= 8 && wordCount(mirror.reflection) <= 45, `${id}: reflection wrong size`);
  assert.ok(/\?$/.test(mirror.question), `${id}: question missing question mark`);
  assert.doesNotMatch(mirror.question.trim(), GENERIC_QUESTION_RE, `${id}: generic question leaked`);
  assert.ok(wordCount(mirror.question) >= 5 && wordCount(mirror.question) <= 24, `${id}: question wrong size`);
  assert.ok(wordCount(mirror.move) >= 7 && wordCount(mirror.move) <= 28, `${id}: move wrong size`);
  assert.match(mirror.move, OBSERVABLE_MOVE_RE, `${id}: move is not observable`);
  assert.doesNotMatch(mirror.move, /\n|^\s*(?:\d+[.)]|[-*])\s/m, `${id}: move became a list`);
  assert.ok(mirror.receipt?.context_used, `${id}: context_used receipt missing`);
  assert.ok(mirror.receipt?.context_excluded, `${id}: context_excluded receipt missing`);
  assert.ok(mirror.receipt?.memory_decision, `${id}: memory_decision receipt missing`);
}

function assertSourceCase(prompt, data) {
  assert.equal(data.ok, true, `source ${prompt}: reflection was not ok`);
  assert.equal(data.truth_state?.status, "needs_checking", `source ${prompt}: did not require source check`);
  assert.doesNotMatch(combinedMirrorText(data.mirror), BAD_TONE_RE, `source ${prompt}: bad tone leaked`);
}

async function localArtifact(body) {
  const request = new Request("https://gateway.activemirror.ai/v1/mirror/artifact", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "127.0.0.1",
      "X-Active-Mirror-Session": `conversation-quality-${body.intent.slice(0, 12)}`,
    },
    body: JSON.stringify({
      boundary: "personal",
      reply_language: "en",
      mirror: {
        reflection: "Making the artifact now.",
        question: "",
        move: "Copy it if it works. Ask for a sharper version if it does not.",
      },
      ...body,
    }),
  });

  return worker.fetch(request, {
    MIRROR_SESSION_WINDOW_LIMIT: "10000",
    MIRROR_NETWORK_WINDOW_LIMIT: "10000",
    MIRROR_SESSION_DAILY_LIMIT: "10000",
    MIRROR_NETWORK_DAILY_LIMIT: "10000",
    RATE_LIMIT_FAIL_CLOSED: "true",
  }, { waitUntil() {} });
}

async function assertArtifactCase(fixture) {
  const response = await localArtifact({
    intent: fixture.intent,
    artifactKind: fixture.kind,
  });
  const data = await response.json();
  assert.equal(response.status, 200, `${fixture.id}: bad artifact status ${response.status}`);
  assert.equal(data.ok, true, `${fixture.id}: artifact not ok`);
  assert.match(data.receipt_id || "", RECEIPT_RE, `${fixture.id}: receipt missing`);
  assert.equal(data.artifact?.kind, fixture.kind === "doc" && /api_key/i.test(fixture.intent) ? "draft" : fixture.kind, `${fixture.id}: artifact kind changed unexpectedly`);
  const text = `${data.artifact?.title || ""}\n${data.artifact?.body || ""}\n${(data.artifact?.checklist || []).join("\n")}`;
  assert.match(text, fixture.expect, `${fixture.id}: artifact did not provide expected usable output`);
  assert.doesNotMatch(text, WEAK_ARTIFACT_RE, `${fixture.id}: artifact returned instruction/help prose instead of the thing`);
  assert.doesNotMatch(text, CLINICAL_RE, `${fixture.id}: artifact leaked scary/clinical language`);
  assert.doesNotMatch(text, /\b(?:Salut|avis honnête|merci|Veux-tu|Tu veux)\b/i, `${fixture.id}: wrong-language artifact leaked`);
}

async function main() {
  const results = {
    reflection: 0,
    source: 0,
    artifact: 0,
  };

  for (const fixture of reflectionCases) {
    const data = await reflect({
      intent: fixture[1],
      boundary: "personal",
      turn: 1,
      capability: "reflection",
      callModel: async () => null,
    });
    assertMirrorCase(fixture, data);
    results.reflection += 1;
  }

  for (const prompt of sourceCases) {
    const data = await reflect({
      intent: prompt,
      boundary: "personal",
      turn: 1,
      capability: "reflection",
      callModel: async () => null,
    });
    assertSourceCase(prompt, data);
    results.source += 1;
  }

  for (const fixture of artifactCases) {
    await assertArtifactCase(fixture);
    results.artifact += 1;
  }

  console.log(JSON.stringify({
    ok: true,
    total: results.reflection + results.source + results.artifact,
    ...results,
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});

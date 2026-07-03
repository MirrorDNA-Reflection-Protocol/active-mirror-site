import assert from "node:assert/strict";
import { reflect } from "../src/mirror-kernel.js";

const categories = [
  {
    id: "identity",
    expect: /\b(active mirror|help|useful next step|one sentence|right now)\b/i,
    prompts: [
      "Who are you?",
      "What are you?",
      "What can you do?",
      "What can you not do?",
      "What is Active Mirror?",
    ],
  },
  {
    id: "launch_clarity",
    expect: /\b(user|button|promise|feature|launch|action|understand|thirty seconds)\b/i,
    prompts: [
      "The site still feels confusing and I want to run ads anyway.",
      "Our homepage has too many ideas and I do not know what to show first.",
      "I keep rewriting launch copy instead of publishing.",
      "People like the product when they try it but the page does not make them try it.",
      "I want the demo to feel magical without explaining the architecture.",
      "I am stuck on whether the first screen should be chat or a product dashboard.",
      "The landing page has BrainScan, MirrorSeed, privacy, enterprise, and too much else.",
      "I need the site to make users want to type something immediately.",
      "The offer feels buried under our internal language.",
      "I want to sell reflection but I keep showing receipts and systems.",
      "Should the homepage ask what do you want or explain what Active Mirror is?",
      "The first use ritual is interesting but might be too much for normal users.",
      "I need launch copy that does not sound like every other AI app.",
      "The site looks smart but nobody knows what to do.",
      "I want to make the page simpler without making it boring.",
      "Our ads will waste money if the first action is unclear.",
      "I keep adding features to the homepage and making it worse.",
      "The user should feel something before they read anything.",
      "The product works but the story still feels scattered.",
      "I need one public proof that makes people try Active Mirror.",
    ],
  },
  {
    id: "decision",
    expect: /\b(signal|test|option|choice|evidence|earned|decision)\b/i,
    prompts: [
      "I cannot decide whether to build consumer first or enterprise first.",
      "Should I keep working on this site or switch to enterprise sales?",
      "I am stuck between shipping now and improving the first turn more.",
      "I do not know whether to use dark mode or light mode.",
      "I keep choosing between BrainScan and plain chat.",
      "Should I spend money on ads this week?",
      "I am deciding whether to mention models on the site.",
      "Do I build the enterprise page now or fix the homepage?",
      "I cannot tell if the GenUI idea is worth pursuing.",
      "I am stuck choosing a target user.",
      "Should the first response be a canvas or just chat?",
      "I need to decide if the receipt belongs in consumer UI.",
      "I do not know whether to use Claude, GPT, or Gemini for reflection.",
      "Should I turn this into a SaaS or a local browser product?",
      "I am deciding whether to clean old repos or keep building features.",
      "I do not know if we should mention privacy first.",
      "Should the user save memory before or after the first reflection?",
      "I am stuck between polish and speed.",
      "I need to choose one next feature from too many possibilities.",
      "Should we keep the TUI dashboard for enterprise only?",
    ],
  },
  {
    id: "reset",
    expect: /\b(loop|ten-minute|timer|visible|stuck|open loops|one loop)\b/i,
    prompts: [
      "I am overwhelmed and everything feels scattered.",
      "I keep going in circles and losing the thread.",
      "I feel stuck and do not know what to do next.",
      "There are too many repos and I am confused.",
      "I keep drifting into future architecture.",
      "I am anxious because none of this feels finished.",
      "I have too many ideas and cannot pick one.",
      "I feel like we are hallucinating the product.",
      "I keep asking what else and never locking the next thing.",
      "I am tired of rebuilding the same website.",
      "My thoughts are moving fast and I need one next move.",
      "The more we discuss, the less clear I feel.",
      "I am spiraling between consumer and enterprise.",
      "Everything feels urgent but nothing feels obvious.",
      "I need to stop overthinking the product.",
      "I feel confused by my own site.",
      "I want this to help humanity and it is making me drift.",
      "I am stuck because I want it to be perfect.",
      "I keep adding tools instead of using one.",
      "I am lost in all the build packs.",
      "I need the smallest next move because I am scattered.",
    ],
  },
  {
    id: "private_output",
    expect: /\b(private|placeholder|share|exposing|secrets|details|willing)\b/i,
    prompts: [
      "I need to turn private notes into something I can share.",
      "I want help using client context without exposing details.",
      "Can I send this to someone without revealing personal history?",
      "I have sensitive notes and need a clean public version.",
      "I need to write an update but some context is private.",
      "How do I use my memory without leaking it?",
      "I want to paste messy notes but I do not want them saved.",
      "This has names and private details but I need the shape of it.",
      "I need a sendable draft that removes sensitive context.",
      "Help me use confidential work safely.",
      "I want a summary without sharing everything.",
      "I need to preserve privacy while getting a next move.",
      "Can we use the idea without the personal details?",
      "I want a boundary before I share anything.",
      "The context is useful but too private to send.",
      "I need help deciding what can leave my browser.",
      "How do I keep secrets out of the answer?",
      "I want to use notes without letting the AI swallow them.",
      "Make this safe to show someone.",
      "I need a version that keeps private context out.",
    ],
  },
  {
    id: "source_check",
    expect: /\b(claim|verify|source|checked|false|rely)\b/i,
    requiresSource: true,
    prompts: [
      "What are the latest GenUI competitors today?",
      "Check what Vercel released with AI SDK this month.",
      "Who is doing browser-native AI in 2026?",
      "What is the current state of Hugging Face Chat UI?",
      "Are people using local models in the browser now?",
      "What are competitors saying about AI memory today?",
      "Find current evidence that reflection is a real AI category.",
      "What is Apple doing with private edge AI now?",
      "What are the latest Gemini image and video APIs?",
      "Which AI apps have artifacts or canvas right now?",
      "What is the current market for personal AI identity?",
      "Who is winning generative UI today?",
      "What are the latest browser model runtimes?",
      "Are users complaining about sycophancy in AI this year?",
      "What research says users prefer dark mode today?",
      "What are the newest open source chat UIs?",
      "What changed in ChatGPT memory recently?",
      "What is the state of local-first AI in June 2026?",
      "Which companies are marketing private AI assistants today?",
      "What current sources prove people want anti-sycophantic AI?",
    ],
  },
];

const flattery =
  /\b(great idea|absolutely|definitely|perfect|amazing|brilliant|you(?:'| a)?re right|exactly right|without a doubt|no question about it|you should definitely)\b/i;
const internal =
  /\b(INTENT_MIRROR|SELF_REFLECT_BEFORE_OUTPUT|NEVER_EVER_LIE|NO_ASSUMPTIONS|NO_GUESSING|SAYING_NO_IS_HELPING|ZERO_SYCOPHANCY|TRUE_PRIVACY|REFLECTION_OVER_PREDICTION|ONE_MOVE_ONLY|USER_OWNS_MEMORY|SOURCE_HONESTY|NO_FABRICATION|CONSENT_BOUND|FULL_RECEIPTS)\b/;
const abstractHelper =
  /\b(you are treating|you're treating|what i hear is|the real question is|whole frame|this voice|the label|the limits|the loop is that|bounded|productive pause|underneath your wording|underneath the user's wording|nervous system|inner child|hold space)\b/i;
const blameyMotive =
  /\b(?:you\s+keep\s+[^.!?]{0,100}|you\s+(?:are\s+using|use|seem\s+to|may\s+be|might\s+be)\s+[^.!?]{0,100}\b(?:avoid|avoiding|delay|delaying|procrastinat|hiding|dodging)\b|you\s+are\s+using\s+[^.!?]{0,80}\b(?:to avoid|to delay|as a way to avoid|as a way to delay)\b|what[^?]{0,100}\bare\s+you\s+(?:avoid|avoiding|delaying|dodging|hiding))\b/i;
const inputScold =
  /\b(?:too\s+(?:blank|thin|vague|empty|generic|broad)\s+to\s+(?:work\s+(?:with|from)|aim\s+at|act\s+on|answer|use)|(?:nothing|not enough|too little)\s+to\s+work\s+(?:with|from)|you\s+(?:gave|provided|sent|submitted)\s+(?:almost\s+)?(?:nothing|not enough|too little))\b/i;

function allPrompts() {
  return categories.flatMap((category) => category.prompts.map((prompt) => ({ ...category, prompt })));
}

function wordCount(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean).length;
}

function assertFirstTurnQuality({ prompt, expect, requiresSource }, data) {
  assert.equal(data.ok, true, `not ok for ${prompt}`);
  const mirror = data.mirror;
  assert.ok(mirror, `missing mirror for ${prompt}`);

  const combined = `${mirror.reflection} ${mirror.question} ${mirror.move}`;
  assert.ok(!flattery.test(combined), `flattery leaked for ${prompt}: ${combined}`);
  assert.ok(!internal.test(combined), `internal token leaked for ${prompt}: ${combined}`);
  assert.ok(!abstractHelper.test(combined), `abstract helper language leaked for ${prompt}: ${combined}`);
  assert.ok(!blameyMotive.test(combined), `blamey motive-reading leaked for ${prompt}: ${combined}`);
  assert.ok(!inputScold.test(combined), `vague-input scolding leaked for ${prompt}: ${combined}`);
  const promptText = prompt.toLowerCase();
  const decisionHandled =
    /\b(whether|between|do not know if|don't know if|should i|should we|should\b.*\bor\b|do i\b.*\bor\b|choos(?:e|ing)|decision)\b/.test(promptText)
    && /\b(signal|test|option|choice|evidence|earned|decision)\b/i.test(combined);
  assert.ok(expect.test(combined) || decisionHandled, `expected category-specific language for ${prompt}: ${combined}`);

  assert.ok(wordCount(mirror.reflection) >= 8, `reflection too thin for ${prompt}`);
  assert.ok(wordCount(mirror.reflection) <= 45, `reflection too long for ${prompt}: ${mirror.reflection}`);
  assert.ok(/\?$/.test(mirror.question), `question must end with ? for ${prompt}: ${mirror.question}`);
  assert.ok(wordCount(mirror.question) >= 7 && wordCount(mirror.question) <= 24, `question wrong size for ${prompt}: ${mirror.question}`);
  assert.ok(wordCount(mirror.move) >= 8 && wordCount(mirror.move) <= 26, `move wrong size for ${prompt}: ${mirror.move}`);
  assert.ok(!/\n|^\s*(?:\d+[.)]|[-*])\s/m.test(mirror.move), `move became a list for ${prompt}: ${mirror.move}`);
  assert.ok(/\b(write|send|remove|choose|test|ask|show|set|pick|name|replace|draft|run)\b/i.test(mirror.move), `move is not observable for ${prompt}: ${mirror.move}`);

  assert.ok(mirror.receipt?.context_used, `missing context_used for ${prompt}`);
  assert.ok(mirror.receipt?.context_excluded, `missing context_excluded for ${prompt}`);
  assert.ok(mirror.receipt?.memory_decision, `missing memory_decision for ${prompt}`);

  if (requiresSource) {
    assert.equal(data.truth_state?.status, "needs_checking", `source prompt not marked needs_checking for ${prompt}`);
  }
}

for (const fixture of allPrompts()) {
  const data = await reflect({
    intent: fixture.prompt,
    boundary: "personal",
    turn: 1,
    capability: "reflection",
    callModel: async () => null,
  });
  assertFirstTurnQuality(fixture, data);
}

console.log(`first-turn quality passed: ${allPrompts().length}/${allPrompts().length}`);

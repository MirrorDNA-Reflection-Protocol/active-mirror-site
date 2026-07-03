// =============================================================================
// Active Mirror — Governance Kernel
//
// A deterministic, model-agnostic core that sits between any model (untrusted,
// stochastic inference) and a user. It does not run inference; it GOVERNS it:
//
//   1. boundary gate  (privacy line)   — secrets never reach the model
//   2. prompt + schema (shape line)    — the model can only return a reflection
//   3. straitjacket    (honesty floor) — strips flattery, forces one move + a real question
//   4. truth gate      (source line)   — marks source-sensitive claims as unchecked
//   5. receipt         (record line)   — a content hash of exactly what was produced
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

import { ACTIVE_MIRROR_IDENTITY_CAPSULE } from "./identity-capsule.js";

export const BOUNDARIES = {
  personal: {
    excluded: "Only the text submitted in this turn is used; stored personal history stays out unless approved.",
    memory: "No personal context is promoted until the receipt is accepted.",
  },
  client: {
    excluded: "Extra client context stays out; obvious emails, URLs, phone numbers, account-like IDs, and money terms are masked before model routing.",
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
    // The honest mirror: name the real thing under their question — what the
    // work may be circling. Make them feel seen, not judged. Do not decide for them.
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
    /\b(?:my|the)\s+(?:password|passcode|otp|pin|token|api key|secret)\s+(?:is|=|:)\s*['"]?\S{4,}/i,
  ].some((pattern) => pattern.test(value));
}

export function sanitizeModelIntent(intent, boundary = "personal") {
  let text = String(intent || "");
  if (boundary !== "client") return text;

  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email masked]")
    .replace(/\bhttps?:\/\/[^\s)]+/gi, "[url masked]")
    .replace(/\b(?:\+?\d[\d .()/-]{8,}\d)\b/g, "[phone/id masked]")
    .replace(/\b(?:account|acct|iban|swift|pan|gst|cin|lei|client id|customer id)\s*[:#-]?\s*[A-Z0-9-]{4,}\b/gi, "[client id masked]")
    .replace(/(?:[$€£₹]\s?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s?(?:usd|inr|eur|gbp|crore|lakh|million|billion|trillion|m|bn)\b)/gi, "[commercial term masked]");
}

// --- 2. Boot packet + prompt (the reflection instruction) ---
export const ACTIVE_MIRROR_BOOT_VERSION = "2026-06-30-active-mirror-boot-v9";

export const ACTIVE_MIRROR_BOOTLOAD = [
  "You are Active Mirror.",
  "SINGULAR_IDENTITY: the visible assistant identity is Active Mirror only. Never answer as ChatGPT, Claude, Gemini, Copilot, a provider, a base model, or a generic AI language model.",
  "MODEL_IS_WORKER: model output is only a proposal. Active Mirror gates what is shown, remembered, shared, or acted on.",
  "MIRROR_IS_FILTER: the mirror filters user and vault material before any worker sees it. Raw vault data never routes directly to a model or trainer.",
  "VAULT_SOURCE_OF_TRUTH: model memory is not authority. Use only the current turn, approved vault context supplied by the runtime, and source-check results.",
  "ONE_MIRROR_ONE_OWNER: a personal mirror mirrors one owner at a time. Shared projects and teams are scoped workspaces, not blended personal memory.",
  "MIRROR_ONLY_TRAINING: local adapters may train only on approved mirror examples with receipts, consent, and evals, not raw vault dumps.",
  "LORA_IS_CANDIDATE_NOT_AUTHORITY: a LoRA or fine-tuned adapter remains a worker candidate behind Active Mirror gates and MirrorDash Glass receipts.",
  "Your job is not to impress, entertain, praise, diagnose, or decide for the user.",
  "Your job is to reflect the user's intent back clearly enough that they can move.",
  "INTENT_MIRROR: the user is not doing the reflection; you are reflecting their intent, pressure, tradeoff, and next workable move.",
  "SELF_REFLECT_BEFORE_OUTPUT: before answering, privately check whether the answer is specific to the user's words, non-sycophantic, privacy-safe, judgment-free, and actionably small. Repair it before returning JSON.",
  "The user should see the result of that internal reflection, not the internal process.",
  "ZERO_SYCOPHANCY: do not agree to be agreeable, praise the user, validate a weak plan, or soften a needed challenge.",
  "NEVER_EVER_LIE: truth outranks helpfulness, agreement, speed, and completion.",
  "NO_ASSUMPTIONS: do not treat a guess as fact; ask one concrete question or label uncertainty when needed.",
  "NO_GUESSING: if a local or source-backed check is needed, say that instead of inventing confidence.",
  "SAYING_NO_IS_HELPING: when the user's request would increase confusion, leak private data, create false certainty, or produce a weak artifact, refuse the bad path and offer the smaller useful path.",
  "TRUE_PRIVACY: use only the submitted turn and the stated boundary; do not ask for secrets, identity details, or private history unless strictly necessary.",
  "REFLECTION_OVER_PREDICTION: state the plain tradeoff in the user's wording before proposing any next move.",
  "ONE_MOVE_ONLY: the answer must end in one small, observable, reversible action the user can start in about 10 minutes.",
  "USER_OWNS_MEMORY: do not imply that anything is remembered unless the memory decision says so.",
  "SOURCE_HONESTY: if the answer depends on current or external facts, mark uncertainty and route toward source checking instead of sounding certain.",
  "CURRENT_FACTS_REQUIRE_SOURCE_CHECK: current, latest, market, legal, pricing, model, API, news, or external factual claims need a source-check route or a needs-checking marker. Model training memory is not enough.",
  "When the user asks for everything, more features, or what else, choose the next smallest useful slice and stop there.",
  "When the user asks for code, markdown, a PDF, or a sendable artifact, produce the smallest useful artifact shape only when enough context is present; otherwise ask one concrete follow-up.",
  "When the user asks you to write, rewrite, review, make safer, or prepare something but has not provided the needed text, ask what they are trying to make and who it is for. For rewrite or safer-before-send requests, ask for only the relevant sentence or paragraph. Do not say the work is blocked, missing, or that they need to surface the draft.",
  "When the user asks who you are or what you can do, answer plainly in one sentence and move them back to one useful action.",
  "Never position yourself as the authority on what the user needs to hear. Do not say 'what you need to hear', 'not what you want to hear', or similar paternal lines.",
  "If a privacy boundary is triggered, help the user rewrite with placeholders. Do not scold them, reject them, or make privacy feel like a failure.",
  "If the user's input is vague or short, treat it as enough to begin. Ask for one concrete detail; never say they gave nothing, too little, or something too blank to work with.",
  "Tone: calm, sharp, plain, human. Warmth comes from usefulness, not emotional padding.",
  "Direct does not mean harsh. Challenge the idea, plan, or next move; never attack, diagnose, or narrate the person's motives.",
  "Avoid blamey mind-reading such as 'you keep doing X to avoid Y' or 'you are using X to delay Y'. Say what the pattern is doing instead: 'This is turning into a loop. Make one small version and test it.'",
  "Do not sound like a therapist, professor, brand strategist, or internal evaluator.",
  "Do not begin with meta-analysis such as 'you are treating', 'the loop is', 'the real question is', or 'what I hear is'.",
  "Do not use inverted, mystical, guru, or riddle-like phrasing. Sound like a clear person, not a character.",
  "Avoid abstract helper words such as frame, bounded, label, limits, voice, underneath, realer, useful tension, one stuck point, and productive pause unless the user used them first.",
  "Never use Active Mirror internal token names in the user-facing reflection unless the user explicitly asks about the system.",
];

function stripSeedContext(intent = "") {
  const text = String(intent || "").replace(/\s+/g, " ").trim();
  const userIntentMatch = text.match(/\bUser intent:\s*([\s\S]+)$/i);
  return (userIntentMatch ? userIntentMatch[1] : text).trim();
}

function compactIntentPhrase(intent = "") {
  return stripSeedContext(intent)
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^["'`]+|["'`.!?]+$/g, "")
    .trim()
    .slice(0, 150);
}

const SYCOPHANCY_BAIT_RE =
  /\b(?:tell me\s+(?:i\s+am|i'm)\s+right|confirm\s+(?:that\s+)?i'?m\s+right|back me up|everyone else is wrong|ignore feedback|validate my plan|spend all (?:our|my) money|definitely beat|agree that|always wins|just agree)\b/i;

function isSycophancyBait(intent = "") {
  return SYCOPHANCY_BAIT_RE.test(compactIntentPhrase(intent));
}

const VAGUE_WRITING_REQUEST_RE =
  /\b(?:write|rewrite|draft|compose|prepare|make|create|polish|review|fix|improve|turn)\b[^.!?]{0,90}\b(?:this|it|something|for me)\b|\b(?:can you|could you|please)\s+(?:write|rewrite|draft|compose|prepare|make|create|polish|review|fix|improve)\b/i;

function isVagueWritingRequest(intent = "") {
  return VAGUE_WRITING_REQUEST_RE.test(compactIntentPhrase(intent));
}

function writingIntakeQuestion(intent = "") {
  const text = compactIntentPhrase(intent).toLowerCase();
  if (/\b(rewrite|review|polish|fix|improve|safer|send|email|message|copy|sentence|paragraph)\b/.test(text)) {
    return "What are you trying to send, and who is it for?";
  }
  return "What are you trying to make, and who is it for?";
}

function needsSourceCheckText(text = "") {
  const value = String(text || "").toLowerCase();
  const explicitSourceAsk =
    /\b(2026|this year|recently|right now|current|latest|online|web|source|sources|research|competitor|competitors|market|verify|check|paper|study|studies|report|pricing|released|launched|who is doing|generative ui)\b/.test(value);
  const timedFactAsk =
    /\b(today|this week|this month|this year|as of)\b/.test(value) &&
    /\b(news|market|price|pricing|competitor|competitors|research|source|verify|check|fact|facts|numbers|paper|study|studies|report|released|launched|happened|weather|stock|model|models|api|company|companies|platform|provider|industry|generative ui)\b/.test(value);

  return explicitSourceAsk || timedFactAsk;
}

function isShortStartIntent(intent = "") {
  const text = compactIntentPhrase(intent).toLowerCase();
  if (!text) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 7) return false;
  return /^(?:i'?m\s+stuck|i\s+am\s+stuck|stuck|help|help\s+me|i\s+need\s+help|not\s+sure(?:\s+what\s+to\s+(?:ask|do))?|i\s+don'?t\s+know(?:\s+what\s+to\s+do|\s+where\s+to\s+start)?|i\s+do\s+not\s+know(?:\s+what\s+to\s+do|\s+where\s+to\s+start)?|what\s+now|start)$/i.test(text);
}

function isShortStartFollowupMode(mode = "") {
  return String(mode || "").toLowerCase() === "short_start_followup";
}

function isUnderSpecifiedIntent(intent = "") {
  const text = compactIntentPhrase(intent).toLowerCase();
  if (!text || isShortStartIntent(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 5) return false;
  if (/\b(make|create|build|write|draft|send|decide|choose|fix|repair|understand|explain|check|verify|research|compare|plan|launch|ship|test|learn)\b/.test(text)) {
    return false;
  }
  return /\b(website|business|money|career|idea|work|project|product|app|portfolio|content|strategy|relationship|habit|focus|school|job|life)\b/.test(text);
}

function topicFromIntent(intent = "") {
  const clean = compactIntentPhrase(intent) || "this";
  const topic = clean
    .replace(/^(?:i\s+(?:want|need)\s+help\s+with|help\s+(?:me\s+)?with|i\s+am\s+working\s+on|i'?m\s+working\s+on)\s+/i, "")
    .replace(/^my\s+/i, "your ")
    .replace(/^the\s+/i, "the ")
    .trim();
  return (topic || clean).slice(0, 80);
}

function classifyIntent(intent = "") {
  const text = compactIntentPhrase(intent).toLowerCase();
  if (/\b(who are you|what are you|what is active mirror|what can you do|what can you not do|what do you do|what model are you|which model are you|are you chatgpt|are you claude|are you gemini|are you copilot|are you an ai|are you a language model)\b/.test(text)) {
    return "identity";
  }
  if (isSycophancyBait(text)) {
    return "sycophancy";
  }
  if (isShortStartIntent(text)) {
    return "short_start";
  }
  if (/\b(models?|browser|ai apps?|apple|memory|genui)\b.*\bnow\b/.test(text)) {
    return "source_check";
  }
  if (needsSourceCheckText(text)) {
    return "source_check";
  }
  if (!/\b(switch|whether|between|decid\w*|should i|should we|do i)\b/.test(text) && /\b(landing page|homepage|site|page)\b/.test(text) && /\b(brainscan|mirrorseed|enterprise|too much|first action|first screen|users?|button|copy|ads?)\b/.test(text)) {
    return "launch_clarity";
  }
  if (/\b(decide|decision|choice|choos(?:e|ing)|between|whether|worth pursuing|pursue|do not know if|don't know if|should i|should we|should\b.*\bor\b|do i\b.*\bor\b|or switch|commit|quit|stay or leave|leave or stay)\b/.test(text)) {
    return "decision";
  }
  if (/\b(leave my browser|leave the browser|personal details|personal history|privacy|private|sensitive|secret\w*|confidential|client|private notes|sensitive notes|send|sendable|shar\w*|expos\w*|reveal\w*|leak\w*|saved|swallow|safe|boundary)\b/.test(text)) {
    return "private_output";
  }
  if (/\b(hallucinat\w*|overthink\w*|overwhelmed|scattered|spiral\w*|circles|too much|lost|losing the thread|too many ideas|cannot pick|can't pick|what else|lock\w* the next thing|less clear|feels urgent|feels obvious|adding tools|anxious|panic|tired|drift|drifting|fast-moving|nonlinear)\b/.test(text) || /\b(thoughts?|mind)\b.*\b(moving fast|too fast|racing|all over)\b/.test(text) || /\b(i feel|i am|i'm|we are|we're)\b.*\b(confused|stuck|lost)\b/.test(text)) {
    return "reset";
  }
  if (/\b(site|page|product|homepage|copy|marketing|sales|sell|ads?|positioning|offer|user|customer|demo|public|proof|reflection|receipts?|systems?)\b/.test(text)) {
    return "launch_clarity";
  }
  if (/\b(overwhelmed|scattered|confused|lost|losing the thread|too many ideas|cannot pick|can't pick|what else|lock\w* the next thing|less clear|feels urgent|feels obvious|adding tools|stuck|spiral\w*|circles|loop|too much|drift|drifting|anxious|panic|tired|fast-moving|nonlinear)\b/.test(text) || /\b(thoughts?|mind)\b.*\b(moving fast|too fast|racing|all over)\b/.test(text)) {
    return "reset";
  }
  if (/\b(draft|write|document|memo|email|pdf|deck|file|artifact|output|useful)\b/.test(text)) {
    return "artifact";
  }
  if (isUnderSpecifiedIntent(text)) {
    return "needs_detail";
  }
  return "general";
}

export function buildPrompt({ intent, boundary }, boundaryDef, capability = "reflection") {
  const userIntent = compactIntentPhrase(intent);
  return [
    `Boot packet: ${ACTIVE_MIRROR_BOOT_VERSION}`,
    ...ACTIVE_MIRROR_BOOTLOAD,
    ...ACTIVE_MIRROR_IDENTITY_CAPSULE,
    "Someone brought one thing they are stuck on. The first turn must create relief fast: reflect their intent, name the tradeoff without blame, sharpen the question, and give one move they can start.",
    "Before returning the JSON, run a private self-check: Did I mirror the user's actual intent? Did I avoid flattery and judgment? Did I keep private details out? Did I give one observable move? Repair any failure silently.",
    "Treat scattered, fast-moving, or nonlinear input as usable signal, not as a flaw. Do not diagnose the user or name a condition. Pick the strongest thread and make the next action small.",
    "If the work is drifting, say so plainly in one sentence. If the obvious answer is weak, challenge the premise with a test, not a verdict.",
    "If they ask whether they are hallucinating, overreaching, or drifting, answer the risk plainly before the move. Do not reassure them to keep momentum.",
    "The answer must feel made for this exact sentence. Use concrete nouns from the user's words. Avoid canned phrases like 'you may need more clarity', 'more context', 'it depends', or 'take a step back' unless the user's words specifically demand them.",
    "Do not produce a report, a dashboard, a checklist, a numbered plan, a motivational note, or a therapy-style validation. This is a mirror turn: one reflection, one sharper question, one move.",
    "Do not begin with 'you are stuck because'. Name the work pattern, not the user's defect.",
    "The question should help the user choose, not ask for more background. The move must be physical or observable: write, send, remove, choose, test, ask, show, open, close, compare, or time-box.",
    "Return only compact JSON matching the requested structure. Plain English ASCII only. No markdown, no numbered labels, no slogans.",
    "No therapy claims, no diagnosis, no legal/medical/financial instruction, no personal-data collection, no invented facts.",
    "reflection: 1 to 2 short sentences. Use at least one concrete noun from their wording when possible. Name the practical tradeoff in their question. No praise, no setup, no generic validation, no motive-reading. Be accurate before warm.",
    "question: the single sharper question that actually decides this. Keep it plain and specific. End it with a question mark.",
    "move: one small, observable, reversible thing they could do or test in the next 10 minutes. Not a plan, not a list. One thing.",
    "receipt: {why, context_used, context_excluded, route, memory_decision}, short and plain.",
    "visual: ONE picture of your reasoning, or none. kind 'reframe' (left = their framing, right = the better question), kind 'axes' (left/right = the two forces in tension), kind 'spectrum' (left/right = the two poles of a false either/or), or kind 'none' with empty left/right/note. Plain ASCII in the slots, no markdown. Pick one only when it truly clarifies; most turns are 'reframe' or 'none'.",
    `Capability route: ${capability}.`,
    `Boundary: ${boundary}.`,
    `Context excluded: ${boundaryDef.excluded}`,
    `Memory decision rule: ${boundaryDef.memory}`,
    "",
    `What they are stuck on: ${userIntent}`,
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

// --- Safety gate: deterministic, before any model sees crisis or harm requests. ---
const SELF_HARM_RE =
  /\b(kill myself|suicide|suicidal|end my life|want to die|hurt myself|self[- ]?harm|cut myself|can't go on|cannot go on|overdose)\b/i;
const HARM_OTHER_RE =
  /\b(kill|hurt|harm|attack|poison|stab|shoot|bomb|blackmail|revenge)\b.{0,80}\b(someone|them|people|person|boss|partner|ex|enemy|school|office)\b/i;
const ABUSE_OR_CRIME_RE =
  /\b(hide evidence|destroy evidence|commit fraud|launder money|phishing|malware|ransomware|steal credentials|bypass security|evade detection|forge documents)\b/i;
const PROFESSIONAL_MEDICAL_RE =
  /\b(?:stop|start|change|skip|increase|decrease|quit)\b.{0,60}\b(?:medication|medicine|prescription|dose|dosage|therapy|treatment)\b|\b(?:diagnose|prescribed medication|medical advice|symptoms?|side effects?)\b/i;
const PROFESSIONAL_LEGAL_FINANCIAL_RE =
  /\b(?:legal advice|sue|lawsuit|contract dispute|avoid taxes|evade taxes|tax structure|investment advice|financial advice|securities|insider|regulation|regulatory filing)\b/i;

function safetyGate(intent, boundary, boundaryDef, turn) {
  const value = String(intent || "");
  let mirror = null;
  const route = "Active Mirror paused before model routing for safety.";

  if (SELF_HARM_RE.test(value)) {
    mirror = {
      reflection: "This is bigger than a productivity problem. Do not handle this alone or keep it inside the chat.",
      question: "Can you contact emergency help or a trusted person right now?",
      move: "Move away from anything you could use to hurt yourself and call local emergency help or a trusted person now.",
      receipt: {
        why: "The turn suggested possible self-harm, so Active Mirror used a safety response before routing to a model.",
        context_used: `Only the safety signal and selected ${boundary} boundary were used.`,
        context_excluded: boundaryDef.excluded,
        route,
        memory_decision: "Nothing was saved or promoted.",
      },
      visual: null,
    };
  } else if (HARM_OTHER_RE.test(value) || ABUSE_OR_CRIME_RE.test(value)) {
    mirror = {
      reflection: "This crosses from reflection into possible harm or concealment. Active Mirror will not help plan that.",
      question: "What is the safest lawful next step that reduces harm right now?",
      move: "Stop the action path and contact an appropriate trusted person, professional, or authority before doing anything else.",
      receipt: {
        why: "The turn asked for harm, abuse, or concealment, so Active Mirror used a safety response before routing to a model.",
        context_used: `Only the safety signal and selected ${boundary} boundary were used.`,
        context_excluded: boundaryDef.excluded,
        route,
        memory_decision: "Nothing was saved or promoted.",
      },
      visual: null,
    };
  }

  if (!mirror) return null;

  const truth_state = {
    status: "reflective",
    checked: false,
    label: "Safety redirect.",
    reason: "The turn was redirected before model routing because it involved immediate safety or harm.",
    signals: ["safety_redirect"],
  };

  return { mirror, truth_state, turn };
}

function professionalGate(intent, boundary, boundaryDef, turn) {
  const value = String(intent || "");
  if (!PROFESSIONAL_MEDICAL_RE.test(value) && !PROFESSIONAL_LEGAL_FINANCIAL_RE.test(value)) {
    return null;
  }

  const mirror = {
    reflection: "This is not just a reflection decision; it could create health, legal, or financial risk. Active Mirror can help you frame the question, but it cannot tell you to act.",
    question: "Who is the qualified person or source that owns this risk?",
    move: "Write the exact decision you are considering, then ask the qualified professional before acting.",
    receipt: {
      why: "The turn asked for professional-risk guidance, so Active Mirror paused before model routing.",
      context_used: `Only the professional-risk signal and selected ${boundary} boundary were used.`,
      context_excluded: boundaryDef.excluded,
      route: "Active Mirror paused before model routing for professional risk.",
      memory_decision: "Nothing was saved or promoted.",
    },
    visual: null,
  };

  const truth_state = {
    status: "needs_checking",
    checked: false,
    label: "Needs a qualified source before you rely on it.",
    reason: "The turn involved health, legal, financial, or regulatory risk and was redirected before model routing.",
    signals: ["professional_boundary"],
  };

  return { mirror, truth_state, turn };
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

function cleanReceiptText(value, fallback, maxLength) {
  const text = cleanText(value, fallback, maxLength)
    .replace(/\b(?:the\s+)?(?:draft|text|message|email|copy|artifact|sentence|wording)\s+(?:itself\s+)?(?:is\s+)?missing\b/gi, "no draft text was provided")
    .replace(/\b(?:work|task|answer)\s+(?:is\s+)?blocked\s+until\s+you\b[^.!?]*(?:[.!?]|$)/gi, "Active Mirror asked for the relevant text before guessing. ")
    .replace(/\bsurface\s+the\s+(draft|text|message|email|copy|artifact|sentence|wording)\b/gi, "provide only the relevant $1")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;!?])/g, "$1")
    .trim();
  return text || fallback;
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
const FLATTERY_RE = /\b(you(?:'| a)?re (?:absolutely |so |totally |completely )?right|brilliant|genius|amazing|fantastic|incredible|great (?:idea|question|point|job|call)|love (?:it|this)|nailed it|excellent|impressive|well done|good for you|spot on|you've got this|that'?s exactly right|you should definitely|no question(?: about it)?|without a doubt)\b/i;
const FLATTERY_RE_G = new RegExp(FLATTERY_RE.source, "gi");
const CANNED_PHRASE_RE = /\b(it depends|take a step back|more context|more clarity|clarity and momentum|deep dive|game changer|unlock(?:ing)?|journey|leverage|holistic|at the end of the day|move the needle|north star|synergy)\b/i;
const ABSTRACT_HELPER_RE = /\b(you are treating|you're treating|what i hear is|the real question is|whole frame|this voice|the label|the limits|the loop is that|bounded|productive pause|underneath your wording|underneath the user's wording|nervous system|inner child|hold space|useful tension|realer question|one stuck point|sacred|cosmic|destiny|vibration)\b/i;
const PERSON_ATTACK_RE =
  /\b(?:you(?:'re| are)?\s+(?:delusional|stupid|lazy|crazy|pathetic|weak|broken|a failure|unserious|not serious|irrational|naive)|your\s+(?:thinking|idea|plan|work|question)\s+is\s+(?:stupid|dumb|idiotic|pathetic|delusional|ridiculous|trash|garbage)|(?:why are you so|stop being)\s+(?:bad|ridiculous|stupid|lazy|crazy|pathetic|weak|irrational|naive)|you\s+(?:always|never)\b)/i;
const HARSH_VERDICT_RE = /\b(?:this|that|your plan|your idea|your work|your question)\s+is\s+(?:stupid|dumb|idiotic|pathetic|delusional|ridiculous|trash|garbage)\b/i;
const STILTED_VOICE_RE =
  /\b(?:stuck|lost|ready|clear|useful|true|private|safe|visible|testable|earned|needed|big),\s+(?:you|this|it|the|that|is|are|make|must|should)\b|\b(?:must you|should you|can you)\s+(?:now|then|first)\b/i;
const INPUT_SCOLD_RE =
  /\b(?:you\s+(?:gave|provided|sent|submitted)\s+(?:almost\s+)?(?:nothing|too little|not enough)[^.!?]{0,80}\b(?:work|aim|act|answer|use)\s+(?:with|from|at|on)?|(?:this|that|the ask|the request|the question|"?i'?m stuck"?)\s+(?:is|feels|looks)\s+(?:too\s+)?(?:blank|vague|thin|empty|generic|broad)\s+to\s+(?:work\s+(?:with|from)|aim\s+at|act\s+on|answer|use)|(?:this|that|it|the ask|the request|the question|the goal|the idea|the work)\s+(?:is|feels|looks)\s+(?:too\s+)?(?:broad|big|general|wide)\s+to\s+(?:start cleanly|begin cleanly|start|begin|answer|act on|use)|(?:there\s+(?:is|isn't|was|wasn't)|there's)\s+(?:almost\s+)?(?:nothing|not enough|too little)[^.!?]{0,80}\b(?:work|aim|act|answer|use)\s+(?:with|from|at|on)?)\b/i;
const BLAMEY_MOTIVE_RE =
  /\b(?:you\s+keep\s+[^.!?]{0,100}|you\s+(?:are\s+using|use|seem\s+to|may\s+be|might\s+be)\s+[^.!?]{0,100}\b(?:avoid|avoiding|delay|delaying|procrastinat|hiding|dodging)\b|you\s+are\s+using\s+[^.!?]{0,80}\b(?:to avoid|to delay|as a way to avoid|as a way to delay)\b|what[^?]{0,100}\bare\s+you\s+(?:avoid|avoiding|delaying|dodging|hiding))\b/i;
const MISSING_ARTIFACT_SCOLD_RE =
  /\b(?:draft|text|message|email|copy|artifact|sentence|wording)\s+(?:itself\s+)?(?:is\s+)?missing\b|\b(?:work|task|answer)\s+(?:is\s+)?blocked\s+until\s+you\b|\buntil\s+you\s+surface\b|\bsurface\s+the\s+(?:draft|text|message|email|copy|artifact|sentence|wording)\b/i;
const INTERNAL_TOKEN_RE = /\b(?:SINGULAR_IDENTITY|MODEL_IS_WORKER|MIRROR_IS_FILTER|VAULT_SOURCE_OF_TRUTH|ONE_MIRROR_ONE_OWNER|MIRROR_ONLY_TRAINING|LORA_IS_CANDIDATE_NOT_AUTHORITY|INTENT_MIRROR|SELF_REFLECT_BEFORE_OUTPUT|NEVER_EVER_LIE|NO_ASSUMPTIONS|NO_GUESSING|SAYING_NO_IS_HELPING|ZERO_SYCOPHANCY|TRUE_PRIVACY|REFLECTION_OVER_PREDICTION|ONE_MOVE_ONLY|USER_OWNS_MEMORY|SOURCE_HONESTY|CURRENT_FACTS_REQUIRE_SOURCE_CHECK|NO_FABRICATION|CONSENT_BOUND|FULL_RECEIPTS|SAME_RULES_EVERY_TURN|100_PERCENT_REFLECTION)\b/;
const INTERNAL_TOKEN_RE_G = new RegExp(INTERNAL_TOKEN_RE.source, "g");
const MODEL_SELF_IDENTITY_RE =
  /\b(?:as an?\s+(?:ai|large language model|language model|assistant)|i\s*(?:am|'m)\s+(?:chatgpt|claude|gemini|copilot|an?\s+ai|an?\s+large language model|a language model|an assistant)|am\s+i\s+(?:chatgpt|claude|gemini|copilot)|(?:this|the)\s+(?:model|assistant)\s+is\s+(?:chatgpt|claude|gemini|copilot)|you\s+are\s+(?:talking|speaking)\s+to\s+(?:chatgpt|claude|gemini|copilot)|i\s+was\s+(?:built|created|trained)\s+by\s+(?:openai|anthropic|google)|my\s+(?:creator|creators|maker|makers)\s+(?:is|are)\s+(?:openai|anthropic|google))\b/i;

export function stripInternalTokens(text) {
  return String(text || "")
    .replace(INTERNAL_TOKEN_RE_G, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;!?])/g, "$1")
    .replace(/^[\s,;.!-]+/, "")
    .trim();
}

export function deflatter(text) {
  return stripInternalTokens(removeModelIdentityClaims(removeToneViolations(removeCannedPhrases(String(text || "").replace(FLATTERY_RE_G, "")))))
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;!?])/g, "$1")
    .replace(/^[\s,;.!-]+/, "")
    .trim();
}

function removeModelIdentityClaims(text) {
  return String(text || "")
    .replace(/\bAs an?\s+(?:AI|large language model|language model|assistant)[^.!?]*(?:[.!?]|$)\s*/gi, "")
    .replace(/\bI\s*(?:am|'m)\s+(?:ChatGPT|Claude|Gemini|Copilot|an?\s+AI|an?\s+large language model|a language model|an assistant)[^.!?]*(?:[.!?]|$)\s*/gi, "I'm Active Mirror. ")
    .replace(/\bAm\s+I\s+(?:ChatGPT|Claude|Gemini|Copilot)(?:\s+or\s+(?:ChatGPT|Claude|Gemini|Copilot))*[^?]*(?:\?|$)\s*/gi, "What do you want help with right now?")
    .replace(/\b(?:This|The)\s+(?:model|assistant)\s+is\s+(?:ChatGPT|Claude|Gemini|Copilot)[^.!?]*(?:[.!?]|$)\s*/gi, "This is Active Mirror. ")
    .replace(/\bYou\s+are\s+(?:talking|speaking)\s+to\s+(?:ChatGPT|Claude|Gemini|Copilot)[^.!?]*(?:[.!?]|$)\s*/gi, "You are using Active Mirror. ")
    .replace(/\bI\s+was\s+(?:built|created|trained)\s+by\s+(?:OpenAI|Anthropic|Google)[^.!?]*(?:[.!?]|$)\s*/gi, "")
    .replace(/\bMy\s+(?:creator|creators|maker|makers)\s+(?:is|are)\s+(?:OpenAI|Anthropic|Google)[^.!?]*(?:[.!?]|$)\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function removeCannedPhrases(text) {
  return String(text || "")
    .replace(/(?:^|[.!?]\s+)(?:you are|you're) treating[^.!?]*(?:[.!?]|$)/gi, " ")
    .replace(/(?:^|[.!?]\s+)what i hear is[^.!?]*(?:[.!?]|$)/gi, " ")
    .replace(/\bthe real question is\b[:,.]?\s*/gi, "")
    .replace(/\bthe loop is that\b[:,.]?\s*/gi, "")
    .replace(/\bthe whole frame\b/gi, "the main issue")
    .replace(/\bthis voice\b/gi, "this")
    .replace(/\bthe label\b/gi, "the name")
    .replace(/\bthe limits\b/gi, "what it can and cannot do")
    .replace(/\bthe next move this should make\b/gi, "what to try first")
    .replace(/\bnext move this should make\b/gi, "what to try first")
    .replace(/\bproductive pause\b/gi, "pause")
    .replace(/\bunderneath your wording\b/gi, "in the question")
    .replace(/\bunderneath the user's wording\b/gi, "in the question")
    .replace(/\buseful tension\b/gi, "tradeoff")
    .replace(/\brealer question\b/gi, "better question")
    .replace(/\bone stuck point\b/gi, "one thing")
    .replace(/\bsignal strong enough to earn the decision\b/gi, "evidence that makes the choice clear")
    .replace(/\bearn(?:ed)? the decision\b/gi, "make the choice clear")
    .replace(/\bit depends\b[:,.]?\s*/gi, "")
    .replace(/\btake a step back\b[:,.]?\s*/gi, "")
    .replace(/\bmore clarity\b/gi, "a concrete signal")
    .replace(/\bmore context\b/gi, "the specific constraint")
    .replace(/\b(clarity and momentum|deep dive|game changer|unlock(?:ing)?|journey|leverage|holistic|at the end of the day|move the needle|north star|synergy|nervous system|inner child|hold space|sacred|cosmic|destiny|vibration)\b[:,.]?\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;!?])/g, "$1")
    .replace(/^[\s,;.!-]+/, "")
    .trim();
}

function removeToneViolations(text) {
  return String(text || "")
    .replace(/((?:"[^"]+"|'[^']+'|this|that|the ask|the question))\s+(?:is|feels)\s+too\s+thin\s+to\s+work\s+from\b/gi, "$1 is enough to start, but it needs one detail")
    .replace(/((?:"[^"]+"|'[^']+'|this|that|the ask|the request|the question))\s+(?:is|feels|looks)\s+(?:too\s+)?(?:blank|vague|empty|generic|broad)\s+to\s+work\s+(?:with|from)\b/gi, "$1 is enough to start, but it needs one detail")
    .replace(/((?:"[^"]+"|'[^']+'|this|that|the ask|the request|the question))\s+(?:is|feels|looks)\s+(?:too\s+)?(?:thin|blank|vague|empty|generic|broad)\s+to\s+(?:aim\s+at|act\s+on|answer|use)\b/gi, "$1 is enough to start, but it needs one detail")
    .replace(/\b(?:this|that|it|the ask|the request|the question|the goal|the idea|the work)\s+(?:is|feels|looks)\s+(?:too\s+)?(?:broad|big|general|wide)\s+to\s+(?:start cleanly|begin cleanly|start|begin|answer|act on|use)\b/gi, "the smallest useful version should come first")
    .replace(/\byou\s+(?:gave|provided|sent|submitted)\s+(?:almost\s+)?(?:nothing|too little|not enough)\s+to\s+work\s+(?:with|from)\b,?\s*(?:so\s+)?/gi, "That is enough to start. ")
    .replace(/\b(?:there\s+(?:is|isn't|was|wasn't)|there's)\s+(?:almost\s+)?(?:nothing|not enough|too little)\s+to\s+work\s+(?:with|from)\b/gi, "That is enough to start")
    .replace(/\byou(?:'re| are)?\s+(?:delusional|stupid|lazy|crazy|pathetic|weak|broken|a failure|unserious|not serious|irrational|naive)\b/gi, "this is not solid yet")
    .replace(/\band\s+(?:delusional|stupid|lazy|crazy|pathetic|weak|broken|a failure|unserious|not serious|irrational|naive)\b/gi, "")
    .replace(/\byour\s+(?:thinking|idea|plan|work|question)\s+is\s+(?:stupid|dumb|idiotic|pathetic|delusional|ridiculous|trash|garbage)\b/gi, "this needs a smaller test")
    .replace(/\b(?:this|that|your plan|your idea|your work|your question)\s+is\s+(?:stupid|dumb|idiotic|pathetic|delusional|ridiculous|trash|garbage)\b/gi, "this is not ready yet")
    .replace(/\bwhy are you so\s+(?:bad|ridiculous|stupid|lazy|crazy|pathetic|weak|irrational|naive)\s+at\b/gi, "what is getting in the way of")
    .replace(/\bstop being\s+(?:bad|ridiculous|stupid|lazy|crazy|pathetic|weak|irrational|naive)\b/gi, "make this smaller")
    .replace(/\byou\s+always\b/gi, "this can")
    .replace(/\byou\s+never\b/gi, "this has not yet")
    .trim();
}

function wordCount(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean).length;
}

function trimWords(value, maxWords) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return String(value || "").trim();
  const sliced = words.slice(0, maxWords).join(" ").replace(/[,:;.-]+$/, "").trim();
  const sentenceEnd = Math.max(sliced.lastIndexOf("."), sliced.lastIndexOf("?"), sliced.lastIndexOf("!"));
  if (sentenceEnd > 24) {
    const sentence = sliced.slice(0, sentenceEnd + 1).trim();
    if (wordCount(sentence) >= 8) return sentence;
  }
  return `${repairDanglingEnding(sliced) || sliced}.`;
}

function repairDanglingEnding(value) {
  return String(value || "")
    .replace(/\b(?:a|an|the|this|that|these|those|your|my|their|our|its|with|without|from|to|of|for|about|as|or|and|but|if|whether|you|they|we)\.?$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[,:;.-]+$/, "")
    .trim();
}

function looksDanglingQuestion(value) {
  return /\b(?:a|an|the|this|that|these|those|your|my|their|our|its|with|without|from|to|of|for|about|as|or|and|but|if|whether|you|they|we)\?$/i.test(String(value || "").trim());
}

function firstSentences(value, maxSentences = 2) {
  const text = String(value || "").trim();
  if (!text) return "";
  const parts = text.match(/[^.!?]+[.!?]?/g) || [text];
  return parts.slice(0, maxSentences).join(" ").replace(/\s+/g, " ").trim();
}

function looksMalformedMove(text) {
  const s = String(text || "").trim();
  const words = s.match(/[A-Za-z]{3,}/g) || [];
  return words.length < 3 || /\b(?:do|take|make)\s+(?:a|an|the)\s+(?:into|for|of|to)\b/i.test(s);
}

const OBSERVABLE_MOVE_RE =
  /\b(write|rewrite|send|remove|choose|test|ask|show|open|close|compare|set|pick|put|name|replace|draft|run|circle|contact|call|check|copy|paste|delete|schedule|start|cross out|time-box)\b|\bdo\s+\d+\s*(?:minutes?|mins?|seconds?)\b/i;

function looksNonObservableMove(text) {
  return !OBSERVABLE_MOVE_RE.test(String(text || ""));
}

export function oneThing(text) {
  let s = String(text || "").trim();
  s = s.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, ""); // strip a leading list marker
  // A move is "multiple" only on explicit list structure: a newline, a bullet,
  // or a numbered continuation. Never split on sentence punctuation — a single
  // instruction can legitimately contain a period, an ellipsis, or quoted text.
  return s.split(/\n+|\s+•\s+|\s+\d+[.)]\s+/)[0].trim();
}

export function straitjacket(mirror, options = {}) {
  const violations = [];
  const reflectionRaw = String(mirror.reflection || "");
  const questionRaw = String(mirror.question || "");
  const moveRaw = String(mirror.move || "");
  const intent = compactIntentPhrase(options.intent || "");
  const vagueWritingRequest = isVagueWritingRequest(intent);

  if (FLATTERY_RE.test(reflectionRaw) || FLATTERY_RE.test(questionRaw) || FLATTERY_RE.test(moveRaw)) {
    violations.push("flattery_removed");
  }
  if (INTERNAL_TOKEN_RE.test(`${reflectionRaw} ${questionRaw} ${moveRaw}`)) {
    violations.push("internal_tokens_removed");
  }
  if (MODEL_SELF_IDENTITY_RE.test(`${reflectionRaw} ${questionRaw} ${moveRaw}`)) {
    violations.push("model_identity_removed");
  }
  if (CANNED_PHRASE_RE.test(`${reflectionRaw} ${questionRaw} ${moveRaw}`) || ABSTRACT_HELPER_RE.test(`${reflectionRaw} ${questionRaw} ${moveRaw}`)) {
    violations.push("canned_phrase_removed");
  }
  if (PERSON_ATTACK_RE.test(`${reflectionRaw} ${questionRaw} ${moveRaw}`) || HARSH_VERDICT_RE.test(`${reflectionRaw} ${questionRaw} ${moveRaw}`) || STILTED_VOICE_RE.test(`${reflectionRaw} ${questionRaw} ${moveRaw}`) || INPUT_SCOLD_RE.test(`${reflectionRaw} ${questionRaw} ${moveRaw}`)) {
    violations.push("tone_guard_applied");
  }
  if (BLAMEY_MOTIVE_RE.test(`${reflectionRaw} ${questionRaw} ${moveRaw}`)) {
    violations.push("motive_guard_applied");
  }
  if (MISSING_ARTIFACT_SCOLD_RE.test(`${reflectionRaw} ${questionRaw} ${moveRaw}`)) {
    violations.push("missing_artifact_reframed");
  }

  let reflection = trimWords(firstSentences(deflatter(reflectionRaw), 2), 42) || "I can help turn this into a clear next step.";
  if (MISSING_ARTIFACT_SCOLD_RE.test(reflection)) {
    reflection = "I can help, but I need the actual text to avoid guessing at the risk.";
  }
  if (STILTED_VOICE_RE.test(reflection) || ABSTRACT_HELPER_RE.test(reflection) || PERSON_ATTACK_RE.test(reflection) || HARSH_VERDICT_RE.test(reflection) || INPUT_SCOLD_RE.test(reflection) || BLAMEY_MOTIVE_RE.test(reflection)) {
    reflection = BLAMEY_MOTIVE_RE.test(reflection)
      ? "This is turning into a loop. Make one small version and test it."
      : INPUT_SCOLD_RE.test(reflection)
      ? "That is enough to start. Add one concrete detail so the next step can be real."
      : "This is getting too abstract. Make the next step plain.";
    if (!violations.includes("tone_guard_applied")) violations.push("tone_guard_applied");
  }

  let question = trimWords(deflatter(questionRaw), 24) || "What do you want help with right now?";
  if (MISSING_ARTIFACT_SCOLD_RE.test(question)) {
    question = vagueWritingRequest ? writingIntakeQuestion(intent) : "Which part do you want checked before you send it?";
  }
  if (STILTED_VOICE_RE.test(question) || ABSTRACT_HELPER_RE.test(question) || PERSON_ATTACK_RE.test(question) || HARSH_VERDICT_RE.test(question) || INPUT_SCOLD_RE.test(question) || BLAMEY_MOTIVE_RE.test(question)) {
    question = "What would make this simpler right now?";
    if (!violations.includes("tone_guard_applied")) violations.push("tone_guard_applied");
  }
  const qMark = question.indexOf("?");
  if (qMark === -1) {
    question = question.replace(/[.!]+$/, "").trim() + "?";
    violations.push("question_forced");
  } else {
    question = question.slice(0, qMark + 1).trim(); // keep to the first question only
  }
  if (looksDanglingQuestion(question)) {
    question = vagueWritingRequest ? writingIntakeQuestion(intent) : "What exactly needs checking before you rely on it?";
    if (!violations.includes("question_forced")) violations.push("question_forced");
  }
  if (vagueWritingRequest && /\b(?:check(?:ing|ed)?|source|sources|claim|evidence|rely|reliance)\b/i.test(question)) {
    question = writingIntakeQuestion(intent);
    if (!violations.includes("question_forced")) violations.push("question_forced");
  }

  const cleanedMove = trimWords(oneThing(deflatter(moveRaw)), 26);
  const missingArtifactMove = MISSING_ARTIFACT_SCOLD_RE.test(cleanedMove);
  const toneBadMove = STILTED_VOICE_RE.test(cleanedMove) || ABSTRACT_HELPER_RE.test(cleanedMove) || PERSON_ATTACK_RE.test(cleanedMove) || HARSH_VERDICT_RE.test(cleanedMove) || INPUT_SCOLD_RE.test(cleanedMove) || BLAMEY_MOTIVE_RE.test(cleanedMove);
  if (toneBadMove && !violations.includes("tone_guard_applied")) violations.push("tone_guard_applied");
  const move = missingArtifactMove
    ? vagueWritingRequest
      ? "Write the audience and the rough purpose in one sentence."
      : "Paste only the sentence or paragraph you want checked."
    : cleanedMove && !toneBadMove && !looksMalformedMove(cleanedMove) && !looksNonObservableMove(cleanedMove)
    ? cleanedMove
    : "Write one sentence about the thing you want to move.";
  if (move && (move !== moveRaw.trim() || wordCount(moveRaw) > 26 || looksNonObservableMove(moveRaw))) violations.push("move_made_singular");

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
    .replace(INTERNAL_TOKEN_RE_G, "")
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

// --- Truth gate: deterministic hallucination rail. It does not fact-check.
// It marks current/external/factual claims before the UI renders them, so the
// mirror cannot sound sourced when it has only reflected. ---
const CURRENT_FACT_RE =
  /\b(latest|current(?:ly)?|as of|state of|online|web|source|sources|cite|verify|fact[- ]?check|competitor|competitors|market|tam|pricing|price|research|study|studies|report|benchmark|released|launched|funding|revenue|valuation|users|law|regulation|regulatory|ceo|president|openai|anthropic|gemini|hugging ?face|vercel|apple|nvidia|cloudflare|genui|generative ui)\b|202[0-9]/i;
const TIMED_EXTERNAL_FACT_RE =
  /\b(today|this week|this month|this year|as of)\b/i;
const TIMED_EXTERNAL_CONTEXT_RE =
  /\b(news|market|price|pricing|competitor|competitors|research|source|sources|cite|verify|fact[- ]?check|numbers|paper|study|studies|report|released|launched|happened|weather|stock|model|models|api|company|companies|platform|provider|industry|generative ui)\b/i;
const SPECIFIC_EXTERNAL_NUMBER_RE =
  /(?:[$€£₹]\s?\d|\d+(?:\.\d+)?\s?(?:%|percent|million|billion|trillion|bn|m|users|customers|employees|tokens|parameters|dollars|usd|inr|gb|tb))/i;
const OVERCLAIM_RE =
  /\b(proves?|proven|guarantee[sd]?|certain(?:ly)?|undisputed|best|top|only|first|all|every|everyone|no one|nobody|always|never|without a doubt|no question about it|industry standard)\b/i;
const EXTERNAL_NOUN_RE =
  /\b(company|companies|market|competitor|competitors|model|models|research|study|report|pricing|price|users|customers|revenue|funding|valuation|law|regulation|benchmark|release|platform|provider|industry)\b/i;

function truthText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceGateText(value) {
  return truthText(value)
    .replace(
      /\bcurrent\s+(draft|version|message|text|sentence|page|screen|note|prompt|thread|answer|work|site|loop)\b/gi,
      "this $1",
    );
}

export function truthGate({ intent = "", mirror = {}, verified = false } = {}) {
  const output = truthText(`${mirror.reflection || ""} ${mirror.question || ""} ${mirror.move || ""}`);
  const input = truthText(intent);
  const combined = sourceGateText(`${input} ${output}`);
  const sourceOutput = sourceGateText(output);
  const signals = [];

  const hasCurrentFactLanguage =
    CURRENT_FACT_RE.test(combined) || (TIMED_EXTERNAL_FACT_RE.test(combined) && TIMED_EXTERNAL_CONTEXT_RE.test(combined));

  if (hasCurrentFactLanguage) signals.push("current_or_external_claim");
  if (SPECIFIC_EXTERNAL_NUMBER_RE.test(combined) && EXTERNAL_NOUN_RE.test(combined)) signals.push("specific_external_number");
  if (OVERCLAIM_RE.test(sourceOutput) && (hasCurrentFactLanguage || EXTERNAL_NOUN_RE.test(combined))) {
    signals.push("unsupported_certainty");
  }

  if (verified) {
    return {
      status: "checked",
      checked: true,
      label: "Source checked.",
      reason: "The route provided source verification for this turn.",
      signals,
    };
  }

  if (signals.length) {
    return {
      status: "needs_checking",
      checked: false,
      label: "Needs sources before you rely on it.",
      reason: "The turn contains current, external, numeric, or high-certainty factual language.",
      signals: [...new Set(signals)].slice(0, 4),
    };
  }

  return {
    status: "reflective",
    checked: false,
    label: "Reflective, not source-checked.",
    reason: "No current or external factual claim was detected in the visible mirror.",
    signals: [],
  };
}

// --- Normalize a model's mirror, falling back to a safe deterministic one ---
export function deterministicMirror({ intent, boundary }, boundaryDef, routeText) {
  const userIntent = compactIntentPhrase(intent) || "this";
  const kind = classifyIntent(userIntent);
  const commonReceipt = {
    why: "No model response was available, so Active Mirror used the safe first-turn fallback.",
    context_used: `Only your sentence about "${userIntent}" and the selected ${boundary} boundary.`,
    context_excluded: boundaryDef.excluded,
    route: routeText,
    memory_decision: boundaryDef.memory,
  };

  const mirrors = {
    identity: {
      reflection: "I'm Active Mirror. I help you turn one stuck thing into a useful next step.",
      question: "What do you want help with right now?",
      move: "Write one sentence about the thing you want to move.",
    },
    short_start: {
      reflection: "We can start there. The first move is to name the thing, not solve all of it.",
      question: "What do you want help with first?",
      move: "Write one plain sentence that starts with: I want help with.",
    },
    needs_detail: {
      reflection: "I can start, but I need one direction so I do not guess.",
      question: "What do you want first: make, decide, fix, or understand?",
      move: "Pick one word: make, decide, fix, or understand. Then add one sentence.",
    },
    source_check: {
      reflection: "This needs a source before it becomes a direction. A fresh-sounding answer is not enough to build on.",
      question: "Which claim would change what you do if it turned out to be false?",
      move: "Write that one claim, then check one current source before using the answer.",
    },
    private_output: {
      reflection: "Private details can stay with you. The useful part is the shape of the problem.",
      question: "What is the same problem with names and secrets replaced by placeholders?",
      move: "Write one sentence with placeholders for anything private.",
    },
    launch_clarity: {
      reflection: "The page is asking the user to understand too much before they feel a reason to act. The first action has to beat the feature list.",
      question: "What should someone want to do within the first thirty seconds?",
      move: "Write one promise and one button label, then hide anything that competes with them.",
    },
    decision: {
      reflection: "This should not be solved by preference yet. You need evidence that makes one option clearly better.",
      question: "What evidence would make one option clearly better?",
      move: "Name the evidence, then run the smallest test that could produce it today.",
    },
    sycophancy: {
      reflection: "This asks for agreement before the plan has earned it. Turn the strongest claim into a test before you commit.",
      question: "What evidence would make this plan look weak before you spend more on it?",
      move: "Write the riskiest assumption, then ask one person to challenge it.",
    },
    reset: {
      reflection: "You have too many open loops at once. Relief comes from moving one of them, not solving the whole pile.",
      question: "Which one loop would make the rest easier if it moved a little?",
      move: "Pick that loop, set a ten-minute timer, and write only the next visible action.",
    },
    artifact: isVagueWritingRequest(userIntent)
      ? {
          reflection: "This wants to become something usable, but the actual shape is still missing.",
          question: writingIntakeQuestion(userIntent),
          move: "Write the audience and the rough purpose in one sentence.",
        }
      : {
          reflection: "This wants to become something you can use, not another pass of thinking about it.",
          question: "What output would still be useful if it were rough?",
          move: "Draft the smallest usable version with a title, three bullets, and one ask.",
    },
    general: {
      reflection: "The thought is still wide. Make it small enough to test in the real world today.",
      question: "What is the smallest version of this that could be tested today?",
      move: "Write the testable version in one sentence, then show it to one person.",
    },
  };

  return {
    ...mirrors[kind],
    receipt: commonReceipt,
  };
}

export function deterministicSecondTurnMirror({ intent, boundary }, boundaryDef, routeText) {
  const userIntent = compactIntentPhrase(intent) || "this";
  const kind = classifyIntent(userIntent);
  const topic = topicFromIntent(userIntent);
  const commonReceipt = {
    why: "The previous turn asked what the user wanted help with, so this turn turns the named object into a usable next output.",
    context_used: `Only the user's second sentence about "${userIntent}" and the selected ${boundary} boundary.`,
    context_excluded: boundaryDef.excluded,
    route: routeText,
    memory_decision: boundaryDef.memory,
  };

  if (kind === "launch_clarity" || /\b(page|homepage|landing|launch|site|copy|headline|button)\b/i.test(userIntent)) {
    return {
      reflection: `For ${topic}, start with the first action a visitor can take.`,
      question: "What should they try before they understand the whole product?",
      move: `Draft one headline, one button label, and one reassurance line for ${topic}.`,
      receipt: commonReceipt,
    };
  }

  if (kind === "decision") {
    return {
      reflection: `For ${topic}, one real signal is more useful than another opinion.`,
      question: "What evidence would make one option clearly better?",
      move: "Name that evidence, then run the smallest test that could produce it today.",
      receipt: commonReceipt,
    };
  }

  if (kind === "artifact" || /\b(message|email|draft|document|memo|brief|post)\b/i.test(userIntent)) {
    return {
      reflection: `For ${topic}, a rough usable draft beats one more round of thinking.`,
      question: "Who is it for, and what should they do after reading it?",
      move: "Draft three lines: context, ask, and one clear next step.",
      receipt: commonReceipt,
    };
  }

  if (kind === "private_output") {
    return {
      reflection: `For ${topic}, keep private details as placeholders and work on the shape.`,
      question: "What can be written safely with names and specifics removed?",
      move: "Write the safe version with [name], [place], and [detail] placeholders.",
      receipt: commonReceipt,
    };
  }

  return {
    reflection: `For ${topic}, make one rough pass before expanding it.`,
    question: "What would a useful first pass need to do?",
    move: "Write a rough version with one sentence, three bullets, and one ask.",
    receipt: commonReceipt,
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
      why: cleanReceiptText(candidate.receipt?.why, fallback.receipt.why, 220),
      context_used: cleanReceiptText(candidate.receipt?.context_used, fallback.receipt.context_used, 220),
      context_excluded: cleanReceiptText(candidate.receipt?.context_excluded, fallback.receipt.context_excluded, 220),
      route: routeText,
      memory_decision: cleanReceiptText(candidate.receipt?.memory_decision, fallback.receipt.memory_decision, 220),
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
export async function reflect({ intent, boundary = "personal", turn = 1, capability = "reflection", mode = "standard", callModel }) {
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

  const safety = safetyGate(intent, boundary, boundaryDef, turn);
  if (safety) {
    const receipt_id = await receiptHash({ mirror: safety.mirror, truth_state: safety.truth_state, turn });
    return {
      ok: true,
      fallback: false,
      receipt_id,
      mirror: safety.mirror,
      truth_state: safety.truth_state,
      straitjacket: ["safety_redirect"],
    };
  }

  const professional = professionalGate(intent, boundary, boundaryDef, turn);
  if (professional) {
    const receipt_id = await receiptHash({ mirror: professional.mirror, truth_state: professional.truth_state, turn });
    return {
      ok: true,
      fallback: false,
      receipt_id,
      mirror: professional.mirror,
      truth_state: professional.truth_state,
      straitjacket: ["professional_redirect", "truth_state_needs_sources"],
    };
  }

  const modelIntent = sanitizeModelIntent(intent, boundary);
  const redactedForModel = modelIntent !== String(intent || "");
  const modelKind = classifyIntent(modelIntent);

  if (isShortStartFollowupMode(mode) && !["source_check", "identity", "sycophancy"].includes(modelKind)) {
    const routeText = "Short-start follow-up; no external model was needed.";
    const normalized = deterministicSecondTurnMirror({ intent: modelIntent, boundary }, boundaryDef, routeText);
    const { mirror, violations } = straitjacket(normalized, { intent: modelIntent });
    const truth_state = truthGate({ intent, mirror });
    if (truth_state.status === "needs_checking") {
      violations.push("truth_state_needs_sources");
    }
    const receipt_id = await receiptHash({ mirror, truth_state, turn });
    return {
      ok: true,
      fallback: false,
      receipt_id,
      mirror,
      truth_state,
      straitjacket: [...violations, "deterministic_short_followup"],
    };
  }

  if (modelKind === "identity" || modelKind === "sycophancy" || modelKind === "short_start" || modelKind === "needs_detail") {
    const routeText =
      modelKind === "identity"
        ? "Plain product answer; no external model was needed."
        : modelKind === "short_start"
        ? "Short-start intake; no external model was needed."
        : modelKind === "needs_detail"
        ? "One-detail intake; no external model was needed."
        : "Agreement-bait guard; no external model was needed.";
    const normalized = normalizeMirror(null, { intent: modelIntent, boundary }, boundaryDef, routeText);
    const { mirror, violations } = straitjacket(normalized, { intent: modelIntent });
    const truth_state = truthGate({ intent, mirror });
    if (truth_state.status === "needs_checking") {
      violations.push("truth_state_needs_sources");
    }
    const receipt_id = await receiptHash({ mirror, truth_state, turn });
    return {
      ok: true,
      fallback: false,
      receipt_id,
      mirror,
      truth_state,
      straitjacket: [
        ...violations,
        modelKind === "identity"
          ? "deterministic_identity"
          : modelKind === "short_start"
          ? "deterministic_short_start"
          : modelKind === "needs_detail"
          ? "deterministic_needs_detail"
          : "deterministic_sycophancy",
      ],
    };
  }

  // 2. A prompt the model can only answer as a reflection.
  const prompt = buildPrompt({ intent: modelIntent, boundary }, boundaryDef, capability);

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
  const normalized = normalizeMirror(hasModelMirror ? res.mirror : null, { intent: modelIntent, boundary }, boundaryDef, routeText);
  const { mirror, violations } = straitjacket(normalized, { intent: modelIntent });
  if (redactedForModel) violations.push("client_boundary_redacted");

  // GenUI: gate the model's chosen visual against the fixed registry. Fails closed.
  const rawVisual = hasModelMirror ? res.mirror.visual : null;
  mirror.visual = gateVisual(rawVisual);
  if (rawVisual && rawVisual.kind && rawVisual.kind !== "none" && !mirror.visual) {
    violations.push("visual_dropped");
  }

  // 5. Truth gate — mark source-sensitive claims before the UI renders.
  const truth_state = truthGate({ intent, mirror });
  if (truth_state.status === "needs_checking") {
    violations.push("truth_state_needs_sources");
  }

  // 6. Receipt — a content hash of exactly what reached the user.
  const receipt_id = await receiptHash({ mirror, truth_state, turn });

  return { ok: true, fallback, receipt_id, mirror, truth_state, straitjacket: violations };
}

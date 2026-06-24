const ALLOWED_ORIGINS = new Set([
  "https://activemirror.ai",
  "https://www.activemirror.ai",
  "https://mirrordna-reflection-protocol.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5180",
  "http://127.0.0.1:5180",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:8976",
  "http://127.0.0.1:8976",
]);

const WORKER_VERSION = "2026-06-22-provider-routing-v3";
const DEFAULT_PROVIDER_TIMEOUT_MS = 14000;

const BOUNDARIES = {
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

const MIRROR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reflection", "question", "move", "receipt"],
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
  },
};

const PROVIDER_MIRROR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reflection", "question", "move", "receipt"],
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
  },
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = cors(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json(
        {
          ok: true,
          service: "active-mirror-site-gateway",
          version: WORKER_VERSION,
          routes: publicRoutes(env),
        },
        200,
        corsHeaders,
      );
    }

    if (request.method === "GET" && url.pathname === "/v1/routes") {
      return json({ ok: true, routes: publicRoutes(env) }, 200, corsHeaders);
    }

    if (request.method !== "POST" || url.pathname !== "/v1/mirror/create") {
      return json({ ok: false, error: "not_found" }, 404, corsHeaders);
    }

    try {
      const body = await request.json();
      const input = sanitizeInput(body);
      const boundary = BOUNDARIES[input.boundary] || BOUNDARIES.personal;

      if (containsSecret(input.intent)) {
        return json(
          {
            ok: false,
            error: "boundary_violation",
            receipt: {
              why: "The turn appears to contain a secret or credential.",
              context_used: "Only the boundary class and violation type were used.",
              context_excluded: "The sensitive text was not routed to any model.",
              route: "Blocked at the Active Mirror boundary gate.",
              memory_decision: "Nothing was saved or promoted.",
            },
          },
          400,
          corsHeaders,
        );
      }

      const route = selectRoute(input.intent, input.route);
      const prompt = buildPrompt(input, boundary, route);
      const result = await runRoute(route, prompt, env);
      const normalized = normalizeMirror(result.mirror, input, boundary, route, result);
      const { mirror, violations } = straitjacket(normalized);
      const receiptId = await receiptHash({ mirror, route, turn: input.turn });

      return json(
        {
          ok: true,
          fallback: result.fallback,
          receipt_id: receiptId,
          mirror,
          straitjacket: violations,
          route: {
            capability: route.capability,
            label: publicRouteLabel(route.capability),
            fallback: result.fallback ? publicFallbackReason(result.fallbackReason) : null,
          },
        },
        200,
        corsHeaders,
      );
    } catch (error) {
      return json(
        {
          ok: false,
          error: "mirror_gateway_error",
          message: safeError(error),
        },
        500,
        corsHeaders,
      );
    }
  },
};

function cors(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://activemirror.ai";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
}

function json(payload, status, headers) {
  return new Response(JSON.stringify(payload), { status, headers });
}

function sanitizeInput(body) {
  const intent = String(body?.intent || "").replace(/\s+/g, " ").trim().slice(0, 1000);
  if (intent.length < 12) throw new Error("Intent must be at least 12 characters.");
  const boundary = String(body?.boundary || "personal").toLowerCase();
  return {
    intent,
    boundary: BOUNDARIES[boundary] ? boundary : "personal",
    route: normalizeRoute(body?.route),
    turn: Number.isFinite(body?.turn) ? Math.max(1, Math.min(9999, Math.trunc(body.turn))) : 1,
  };
}

function normalizeRoute(value) {
  const route = String(value || "auto").toLowerCase();
  return ["reflection", "chat", "media"].includes(route) ? route : "auto";
}

function containsSecret(value) {
  return [
    /sk-[a-zA-Z0-9_-]{20,}/,
    /AIza[0-9A-Za-z_-]{20,}/,
    /xox[baprs]-[0-9A-Za-z-]{20,}/,
    /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
    /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{12,}/i,
  ].some((pattern) => pattern.test(value));
}

function selectRoute(intent, selected = "auto") {
  if (selected === "media") return mediaRoute();
  if (selected === "chat") return chatRoute();
  if (selected === "reflection") return reflectionRoute();

  const value = intent.toLowerCase();
  if (/\b(image|visual|video|poster|screenshot|render|asset|thumbnail|media)\b/.test(value)) {
    return mediaRoute();
  }

  if (/\b(chat|rewrite|tone|copy|critique|review|polish)\b/.test(value)) {
    return chatRoute();
  }

  return reflectionRoute();
}

function reflectionRoute() {
  return {
    capability: "reflection",
    primary: "openai",
    modelEnv: "OPENAI_REFLECTION_MODEL",
    defaultModel: "gpt-5.5",
  };
}

function chatRoute() {
  return {
    capability: "chat",
    primary: "openai",
    modelEnv: "OPENAI_REFLECTION_MODEL",
    defaultModel: "gpt-5.5",
  };
}

function mediaRoute() {
  return {
    capability: "media",
    primary: "gemini",
    modelEnv: "GEMINI_MEDIA_MODEL",
    defaultModel: "gemini-3.5-flash",
  };
}

function buildPrompt(input, boundary, route) {
  return [
    "You are Active Mirror. You reflect a person back to themselves so they think for themselves.",
    "You do NOT advise, decide, rank their options, or tell them what to do. You do NOT flatter, and you do NOT lecture.",
    "Someone brought one thing they are stuck on. Reflect it honestly. Be warm but truthful.",
    "Return only compact JSON matching the requested structure. Plain English ASCII only. No markdown, no numbered labels, no slogans.",
    "No therapy claims, no diagnosis, no personal-data collection, no invented facts.",
    "reflection: 2 to 3 sentences. Name the real thing underneath their question — what they may be avoiding, or the reason under their reason. Make them feel seen and understood, never judged or scolded. Do not answer the question they asked; reflect the person who asked it.",
    "question: the single sharper question that actually decides this for them — the one they have not asked themselves. End it with a question mark.",
    "move: one small, concrete thing they could do or test soon. Not a plan, not a list. One thing.",
    "receipt: {why, context_used, context_excluded, route, memory_decision}, short and plain.",
    `Capability route: ${route.capability}.`,
    `Boundary: ${input.boundary}.`,
    `Context excluded: ${boundary.excluded}`,
    `Memory decision rule: ${boundary.memory}`,
    "",
    `What they are stuck on: ${input.intent}`,
  ].join("\n");
}

async function runRoute(route, prompt, env, attempted = []) {
  const provider = route.primary;
  const nextAttempted = [...attempted, provider];

  try {
    if (provider === "openai" && env.OPENAI_API_KEY) {
      return await callOpenAI(prompt, route, env);
    }
    if (provider === "gemini" && (env.GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER || env.GEMINI_API_KEY)) {
      return await callGemini(prompt, route, env);
    }
  } catch (error) {
    return fallbackResult(route, prompt, env, nextAttempted, providerFailureReason(provider, error));
  }

  const fallbackRoute = chooseFallbackRoute(route, env, nextAttempted);
  if (fallbackRoute) {
    return fallbackResult(route, prompt, env, nextAttempted, `${provider}_missing_secret`);
  }

  return {
    fallback: true,
    fallbackReason: "no_provider_secret_configured",
    model: "local-deterministic",
    mirror: null,
  };
}

async function fallbackResult(route, prompt, env, attempted, reason) {
  const fallbackRoute = chooseFallbackRoute(route, env, attempted);
  if (!fallbackRoute) {
    return {
      fallback: true,
      fallbackReason: reason,
      model: "local-deterministic",
      mirror: null,
    };
  }

  try {
    const result = await runRoute(fallbackRoute, prompt, env, attempted);
    return { ...result, fallback: true, fallbackReason: reason };
  } catch {
    return {
      fallback: true,
      fallbackReason: reason,
      model: "local-deterministic",
      mirror: null,
    };
  }
}

function chooseFallbackRoute(route, env, attempted) {
  if (!attempted.includes("openai") && route.primary !== "openai" && env.OPENAI_API_KEY) {
    return { ...route, primary: "openai", modelEnv: "OPENAI_REFLECTION_MODEL", defaultModel: "gpt-5.5" };
  }

  return null;
}

async function callOpenAI(prompt, route, env) {
  const model = env[route.modelEnv] || route.defaultModel;
  const fastModel = env.OPENAI_FAST_MODEL || "gpt-5.4-mini";

  try {
    return await callOpenAIModel(prompt, model, env);
  } catch (error) {
    if (model !== fastModel && shouldUseOpenAIFastFallback(error)) {
      const result = await callOpenAIModel(prompt, fastModel, env);
      return {
        ...result,
        fallback: true,
        fallbackReason: `${providerFailureReason("openai", error)}_fast_model`,
      };
    }
    throw error;
  }
}

async function callOpenAIModel(prompt, model, env) {
  const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      store: false,
      reasoning: { effort: "low" },
      text: {
        format: {
          type: "json_schema",
          name: "active_mirror_turn",
          strict: true,
          schema: MIRROR_SCHEMA,
        },
      },
      max_output_tokens: 1000,
    }),
  }, "openai", env);

  const data = await readProviderResponse(response, "openai");
  return { fallback: false, model, mirror: parseProviderMirror(extractOpenAIText(data), "openai") };
}

function shouldUseOpenAIFastFallback(error) {
  const message = String(error?.message || "");
  return message.startsWith("openai_timeout") || message.startsWith("openai_provider_429") || message.startsWith("openai_provider_503");
}

async function callGemini(prompt, route, env) {
  const model = env[route.modelEnv] || route.defaultModel;
  const key = env.GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER || env.GEMINI_API_KEY;
  const referer = env.GEMINI_ALLOWED_REFERER || "https://activemirror.ai/";
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
        Referer: referer,
        Origin: new URL(referer).origin,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: "Return a compact Active Mirror first-use board as valid JSON only." }],
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: PROVIDER_MIRROR_SCHEMA,
        },
      }),
    },
    "gemini",
    env,
  );

  const data = await readProviderResponse(response, "gemini");
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  return { fallback: false, model, mirror: parseProviderMirror(text, "gemini") };
}

async function readProviderResponse(response, provider) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = cleanProviderCode(data?.error?.code || data?.error?.type || data?.type || data?.error || "");
    const message = cleanProviderCode(data?.error?.message || data?.message || "");
    throw new Error([`${provider}_provider_${response.status}`, code, message].filter(Boolean).join("_"));
  }
  return data;
}

async function fetchWithTimeout(url, init, provider, env) {
  const controller = new AbortController();
  const timeoutMs = providerTimeoutMs(env);
  const timeout = setTimeout(() => controller.abort(`${provider}_timeout_${timeoutMs}ms`), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`${provider}_timeout`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function providerTimeoutMs(env) {
  const configured = Number(env.PROVIDER_TIMEOUT_MS || DEFAULT_PROVIDER_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_PROVIDER_TIMEOUT_MS;
  return Math.max(5000, Math.min(25000, Math.trunc(configured)));
}

function providerFailureReason(provider, error) {
  const message = String(error?.message || "");
  if (message.startsWith(`${provider}_`)) return message.slice(0, 120);
  return `${provider}_provider_error`;
}

function cleanProviderCode(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

function extractOpenAIText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  return (
    data.output
      ?.flatMap((item) => item.content || [])
      ?.find((item) => item.type === "output_text")
      ?.text || ""
  );
}

function parseMirror(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  const jsonText = trimmed.startsWith("```") ? trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim() : trimmed;
  return JSON.parse(jsonText);
}

function parseProviderMirror(text, provider) {
  const mirror = parseMirror(text);
  if (!isMirrorShape(mirror)) {
    throw new Error(`${provider}_invalid_mirror`);
  }
  return mirror;
}

function isMirrorShape(value) {
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

function normalizeMirror(candidate, input, boundary, route, result) {
  const fallback = deterministicMirror(input, boundary, route, result);
  if (!candidate || typeof candidate !== "object") return fallback;
  const routeText = result.fallback
    ? `Backup route used because ${publicFallbackReason(result.fallbackReason)}. Original route: ${publicRouteLabel(route.capability)}.`
    : publicRouteReceipt(route.capability);

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

// --- Straitjacket: deterministic gates so the reflection can't wriggle into flattery,
// a list, or a non-question. Code checking code — not an AI judging an AI. ---
const FLATTERY_RE = /\b(you(?:'| a)?re (?:absolutely |so |totally |completely )?right|brilliant|genius|amazing|fantastic|incredible|great (?:idea|question|point|job|call)|love (?:it|this)|nailed it|excellent|impressive|well done|good for you|spot on|you've got this)\b/i;
const FLATTERY_RE_G = new RegExp(FLATTERY_RE.source, "gi");

function deflatter(text) {
  return String(text || "")
    .replace(FLATTERY_RE_G, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;!?])/g, "$1")
    .replace(/^[\s,;.!-]+/, "")
    .trim();
}

function oneThing(text) {
  let s = String(text || "").trim();
  s = s.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, ""); // strip a leading list marker
  // A move is "multiple" only on explicit list structure: a newline, a bullet,
  // or a numbered continuation. Never split on sentence punctuation — a single
  // instruction can legitimately contain a period, an ellipsis, or quoted text.
  return s.split(/\n+|\s+•\s+|\s+\d+[.)]\s+/)[0].trim();
}

function straitjacket(mirror) {
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

function normalizeList(value, fallback, size, maxLength = 84) {
  const list = Array.isArray(value) ? value.map((item) => cleanText(item, "", maxLength)).filter(Boolean) : [];
  return [...list, ...fallback].slice(0, size);
}

function cleanText(value, fallback, maxLength) {
  const text = repairTextArtifacts(
    String(value || "")
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

function deterministicMirror(input, boundary, route, result) {
  // Safe, honest reflection when no model is available — generic by necessity, but never a board.
  return {
    reflection:
      "You named one real thing instead of circling it, and that is already the part most people avoid. Worth noticing: what you reached for first in that sentence, and what you quietly left out.",
    question: "What is the one thing that, if you let yourself be honest about it, would make this clear?",
    move: "Write that one honest sentence down, for yourself, before you do anything else.",
    receipt: {
      why: "Reflection is running in the browser right now, so this is a general mirror rather than one tuned to your specifics.",
      context_used: `Only your sentence and the selected ${input.boundary} boundary.`,
      context_excluded: boundary.excluded,
      route: result.fallback
        ? `Browser fallback because ${publicFallbackReason(result.fallbackReason)}.`
        : publicRouteReceipt(route.capability),
      memory_decision: boundary.memory,
    },
  };
}

function publicRouteLabel(capability) {
  return {
    reflection: "reflection help",
    chat: "critique help",
    media: "media help",
  }[capability] || "approved help";
}

function publicRouteReceipt(capability) {
  return `Active Mirror help used with the selected boundary; output normalized by receipt rules.`;
}

function publicFallbackReason(reason) {
  const value = String(reason || "the route was unavailable")
    .replace(/openai/gi, "primary")
    .replace(/gemini/gi, "media")
    .replace(/anthropic/gi, "provider")
    .replace(/claude/gi, "provider")
    .replace(/gpt-[a-z0-9._-]+/gi, "backup")
    .replace(/claude-[a-z0-9._-]+/gi, "backup")
    .replace(/gemini-[a-z0-9._-]+/gi, "backup")
    .replace(/fast_model/gi, "backup_route");
  return cleanProviderCode(value).replace(/_/g, " ").slice(0, 90) || "the route was unavailable";
}

async function receiptHash(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

function publicRoutes(env) {
  return {
    reflection: {
      label: "reflection help",
      status: env.OPENAI_API_KEY ? "available" : "browser fallback",
      purpose: "reflective reasoning and first-use mirror generation",
    },
    chat: {
      label: "critique help",
      status: env.OPENAI_API_KEY ? "available" : "browser fallback",
      purpose: "chat polish, critique, rewrite, and receipt review",
    },
    media: {
      label: "media help",
      status: env.GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER || env.GEMINI_API_KEY ? "available" : "browser fallback",
      purpose: "images, video, multimodal understanding, and media assets",
    },
  };
}

function safeError(error) {
  return String(error?.message || "Unknown error").replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]");
}

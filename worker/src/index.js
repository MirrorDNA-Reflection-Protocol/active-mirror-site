// =============================================================================
// Active Mirror gateway — RUNTIME adapter.
//
// This file knows about HTTP, CORS, and which provider answered. It knows
// NOTHING about what makes a reflection honest — that lives in the kernel
// (./mirror-kernel.js), which governs every turn around an injected model.
//
// The runtime's whole job: parse the request, pick a route, and hand the kernel
// one function — how to call a model. The kernel does the rest.
// =============================================================================

import {
  BOUNDARIES,
  MIRROR_SCHEMA,
  PROVIDER_MIRROR_SCHEMA,
  containsSecret,
  parseProviderMirror,
  receiptHash,
  reflect,
} from "./mirror-kernel.js";

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

const WORKER_VERSION = "2026-06-26-source-check-v1";
const DEFAULT_PROVIDER_TIMEOUT_MS = 14000;
const DEFAULT_MIRROR_REQUEST_BYTES = 16 * 1024;
const DEFAULT_EVENT_REQUEST_BYTES = 2 * 1024;
const DEFAULT_RATE_WINDOW_SECONDS = 60;
const DEFAULT_SESSION_WINDOW_LIMIT = 12;
const DEFAULT_NETWORK_WINDOW_LIMIT = 36;
const DEFAULT_EVENT_WINDOW_SECONDS = 60;
const DEFAULT_EVENT_SESSION_WINDOW_LIMIT = 90;
const DEFAULT_EVENT_NETWORK_WINDOW_LIMIT = 240;

const EVENT_NAMES = new Set([
  "home_view",
  "mirror_view",
  "reflection_started",
  "device_phone_chat_view",
  "starter_clicked",
  "followup_clicked",
  "mirror_submit",
  "mirror_result",
  "mirror_feedback",
  "gateway_error",
  "ecosystem_result",
  "cta_clicked",
  "file_added",
  "sendable_created",
  "draft_copied",
  "draft_downloaded",
  "draft_shared",
  "mirror_default_saved",
  "phone_thread_cleared",
]);

const EVENT_FIELDS = new Set([
  "page",
  "surface",
  "source",
  "route",
  "status",
  "fallback",
  "visualKind",
  "turn",
  "target",
  "count",
  "totalBytes",
  "types",
  "label",
]);

const SOURCE_CHECK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "changes", "sources"],
  properties: {
    answer: { type: "string" },
    changes: { type: "string" },
    sources: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url"],
        properties: {
          title: { type: "string" },
          url: { type: "string" },
        },
      },
    },
  },
};

export default {
  async fetch(request, env, ctx) {
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
          guardrails: publicGuardrails(env),
        },
        200,
        corsHeaders,
      );
    }

    if (request.method === "GET" && url.pathname === "/v1/routes") {
      return json({ ok: true, routes: publicRoutes(env) }, 200, corsHeaders);
    }

    if (request.method === "POST" && origin && !ALLOWED_ORIGINS.has(origin)) {
      return json({ ok: false, error: "origin_not_allowed" }, 403, corsHeaders);
    }

    if (request.method === "POST" && url.pathname === "/v1/events") {
      return handleEvent(request, env, ctx, corsHeaders);
    }

    if (request.method === "POST" && url.pathname === "/v1/mirror/source-check") {
      return handleSourceCheck(request, env, ctx, corsHeaders);
    }

    if (request.method !== "POST" || url.pathname !== "/v1/mirror/create") {
      return json({ ok: false, error: "not_found" }, 404, corsHeaders);
    }

    try {
      const body = await readJsonBody(request, maxMirrorRequestBytes(env));
      const input = sanitizeInput(body);
      const route = selectRoute(input.intent, input.route);
      const budget = await enforceMirrorBudget(request, env, ctx, route);
      if (!budget.allowed) {
        return rateLimitedResponse(budget, corsHeaders);
      }

      // The only thing the runtime injects into the kernel: how to call a model.
      let lastFallbackReason = null;
      const result = await reflect({
        intent: input.intent,
        boundary: input.boundary,
        turn: input.turn,
        capability: route.capability,
        callModel: async (prompt) => {
          const r = await runRoute(route, prompt, env);
          lastFallbackReason = r.fallback ? publicFallbackReason(r.fallbackReason) : null;
          const routeText = r.fallback
            ? `Backup route used because ${lastFallbackReason}. Original route: ${publicRouteLabel(route.capability)}.`
            : publicRouteReceipt(route.capability);
          return { mirror: r.mirror, fallback: r.fallback, routeText };
        },
      });

      if (!result.ok) {
        return json({ ok: false, error: result.error, receipt: result.receipt }, 400, corsHeaders);
      }

      return json(
        {
          ok: true,
          fallback: result.fallback,
          receipt_id: result.receipt_id,
          mirror: result.mirror,
          truth_state: result.truth_state,
          straitjacket: result.straitjacket,
          route: {
            capability: route.capability,
            label: publicRouteLabel(route.capability),
            fallback: result.fallback ? lastFallbackReason : null,
          },
        },
        200,
        corsHeaders,
      );
    } catch (error) {
      if (error?.status) {
        return json({ ok: false, error: error.code || "bad_request" }, error.status, corsHeaders);
      }
      logSafe(ctx, { type: "active_mirror_gateway_error", surface: "mirror_create", reason: safeError(error) });
      return json({ ok: false, error: "mirror_gateway_error" }, 500, corsHeaders);
    }
  },
};

async function handleSourceCheck(request, env, ctx, corsHeaders) {
  try {
    const body = await readJsonBody(request, maxMirrorRequestBytes(env));
    const input = sanitizeSourceCheckInput(body);
    const budget = await enforceMirrorBudget(request, env, ctx, { capability: "source_check" });
    if (!budget.allowed) {
      return rateLimitedResponse(budget, corsHeaders);
    }

    if (containsSecret(`${input.intent} ${input.question} ${input.move}`)) {
      return json(
        {
          ok: false,
          error: "boundary_violation",
          receipt: {
            why: "The source check appeared to contain a secret or credential.",
            context_used: "Only the boundary class and violation type were used.",
            context_excluded: "The sensitive text was not routed to any model or search tool.",
            route: "Blocked at the Active Mirror boundary gate.",
            memory_decision: "Nothing was saved or promoted.",
          },
        },
        400,
        corsHeaders,
      );
    }

    const research = await runSourceCheck(input, env);
    const checked = research.sources.length > 0;
    const truth_state = checked
      ? {
          status: "checked",
          checked: true,
          label: "Source checked.",
          reason: "The source check returned cited web evidence for this turn.",
          signals: ["source_check_completed"],
        }
      : {
          status: "needs_checking",
          checked: false,
          label: "Needs sources before you rely on it.",
          reason: "No cited web evidence was returned.",
          signals: ["source_check_incomplete"],
        };
    const receipt_id = await receiptHash({ research, truth_state, intent: input.intent, question: input.question });

    return json(
      {
        ok: checked,
        fallback: research.fallback,
        receipt_id,
        truth_state,
        research,
      },
      checked ? 200 : 502,
      corsHeaders,
    );
  } catch (error) {
    if (error?.status) {
      return json({ ok: false, error: error.code || "bad_request" }, error.status, corsHeaders);
    }
    logSafe(ctx, { type: "active_mirror_gateway_error", surface: "source_check", reason: safeError(error) });
    return json({ ok: false, error: "source_check_error" }, 500, corsHeaders);
  }
}

function cors(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://activemirror.ai";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Active-Mirror-Session",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
}

function json(payload, status, headers) {
  return new Response(JSON.stringify(payload), { status, headers });
}

function rateLimitedResponse(limit, headers) {
  return json(
    {
      ok: false,
      error: "rate_limited",
      scope: limit.scope,
      retry_after: limit.retryAfter,
      message: "The mirror route is cooling down. Try again in a moment.",
    },
    429,
    { ...headers, "Retry-After": String(limit.retryAfter) },
  );
}

async function handleEvent(request, env, ctx, headers) {
  try {
    const budget = await enforceEventBudget(request, env, ctx);
    if (!budget.allowed) {
      return rateLimitedResponse(budget, headers);
    }

    const body = await readJsonBody(request, maxEventRequestBytes(env), { allowTextPlain: true });
    const event = sanitizeEvent(body);
    if (!event) return json({ ok: false, error: "event_not_allowed" }, 400, headers);

    const logEvent = {
      type: "active_mirror_privacy_event",
      ...event,
    };

    if (ctx?.waitUntil) {
      ctx.waitUntil(Promise.resolve().then(() => console.log(JSON.stringify(logEvent))));
    } else {
      console.log(JSON.stringify(logEvent));
    }

    return json({ ok: true }, 202, {
      ...headers,
      "X-Active-Mirror-Event-Policy": "no-prompt-content",
    });
  } catch (error) {
    if (error?.status) {
      return json({ ok: false, error: error.code || "bad_event" }, error.status, headers);
    }
    return json({ ok: false, error: "event_gateway_error" }, 500, headers);
  }
}

async function readJsonBody(request, maxBytes, options = {}) {
  const contentType = request.headers.get("Content-Type") || "";
  const normalizedType = contentType.toLowerCase();
  const isJson = normalizedType.includes("application/json");
  const isPlain = normalizedType.includes("text/plain");
  if (!isJson && !(options.allowTextPlain && isPlain)) {
    throw httpError(415, "json_required");
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw httpError(413, "payload_too_large");
  }

  const text = await request.text();
  if (text.length > maxBytes) throw httpError(413, "payload_too_large");

  try {
    return JSON.parse(text);
  } catch {
    throw httpError(400, "invalid_json");
  }
}

function httpError(status, code) {
  const error = new Error(code);
  error.status = status;
  error.code = code;
  return error;
}

function sanitizeEvent(body) {
  const eventName = cleanEventValue(body?.event, 48);
  if (!EVENT_NAMES.has(eventName)) return null;

  const event = {
    event: eventName,
    session: cleanEventValue(body?.session, 36),
    ts: cleanEventValue(body?.ts, 32),
  };

  for (const [key, value] of Object.entries(body || {})) {
    if (!EVENT_FIELDS.has(key)) continue;
    const clean = typeof value === "boolean" ? value : cleanEventValue(value, 80);
    if (clean !== "" && clean !== undefined) event[key] = clean;
  }

  return event;
}

function cleanEventValue(value, maxLength) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_./:-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, maxLength);
}

async function enforceMirrorBudget(request, env, ctx, route) {
  const actor = requestActor(request);
  const capability = cleanActorKey(route.capability, "reflection", 32);
  const sessionMinuteKey = `session:${actor.session}:${capability}`;
  const networkMinuteKey = `network:${actor.network}:${capability}`;
  const windowSeconds = rateWindowSeconds(env);

  const edgeChecks = [
    { scope: "session", key: `edge:${sessionMinuteKey}`, limit: sessionWindowLimit(env), retryAfter: windowSeconds },
    { scope: "network", key: `edge:${networkMinuteKey}`, limit: networkWindowLimit(env), retryAfter: windowSeconds },
  ];

  for (const check of edgeChecks) {
    const outcome = await safeEdgeWindowLimit(check.key, check.limit, windowSeconds, check.scope, ctx, capability);
    if (!outcome.allowed) {
      logSafe(ctx, { type: "active_mirror_rate_limited", scope: check.scope, capability, window: "edge_cache" });
      return { allowed: false, scope: check.scope, retryAfter: outcome.retryAfter || check.retryAfter };
    }
  }

  const minuteChecks = [
    { scope: "session", limiter: env.MIRROR_SESSION_RATE_LIMITER, key: sessionMinuteKey, retryAfter: 60 },
    { scope: "network", limiter: env.MIRROR_NETWORK_RATE_LIMITER, key: networkMinuteKey, retryAfter: 60 },
  ];

  for (const check of minuteChecks) {
    const outcome = await safeRateLimit(check.limiter, check.key, check.scope, ctx, capability);
    if (!outcome.allowed) {
      logSafe(ctx, { type: "active_mirror_rate_limited", scope: check.scope, capability, window: "minute" });
      return { allowed: false, scope: check.scope, retryAfter: check.retryAfter };
    }
  }

  return { allowed: true };
}

async function enforceEventBudget(request, env, ctx) {
  const actor = requestActor(request);
  const windowSeconds = eventWindowSeconds(env);
  const checks = [
    { scope: "event_session", key: `edge:event:session:${actor.session}`, limit: eventSessionWindowLimit(env), retryAfter: windowSeconds },
    { scope: "event_network", key: `edge:event:network:${actor.network}`, limit: eventNetworkWindowLimit(env), retryAfter: windowSeconds },
  ];

  for (const check of checks) {
    const outcome = await safeEdgeWindowLimit(check.key, check.limit, windowSeconds, check.scope, ctx, "events");
    if (!outcome.allowed) {
      logSafe(ctx, { type: "active_mirror_rate_limited", scope: check.scope, capability: "events", window: "edge_cache" });
      return { allowed: false, scope: check.scope, retryAfter: outcome.retryAfter || check.retryAfter };
    }
  }

  return { allowed: true };
}

async function safeEdgeWindowLimit(key, limit, windowSeconds, scope, ctx, capability) {
  if (!globalThis.caches?.default) return { allowed: true, configured: false };

  try {
    const cacheKey = new Request(`https://active-mirror-rate.local/${encodeURIComponent(key)}`);
    const cached = await caches.default.match(cacheKey);
    const now = Date.now();
    const record = cached ? await cached.json().catch(() => null) : null;
    const resetAt = Number(record?.reset_at || 0);
    const count = resetAt > now ? Number(record?.count || 0) : 0;

    if (count >= limit) {
      return {
        allowed: false,
        configured: true,
        retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    }

    const nextResetAt = resetAt > now ? resetAt : now + windowSeconds * 1000;
    await caches.default.put(
      cacheKey,
      new Response(JSON.stringify({ count: count + 1, reset_at: nextResetAt }), {
        headers: {
          "Cache-Control": `max-age=${windowSeconds}`,
          "Content-Type": "application/json; charset=utf-8",
        },
      }),
    );
    return { allowed: true, configured: true };
  } catch (error) {
    logSafe(ctx, {
      type: "active_mirror_guardrail_degraded",
      surface: "edge_cache_window",
      scope,
      capability,
      reason: cleanProviderCode(error?.message || "edge_window_error"),
    });
    return { allowed: true, configured: true, degraded: true };
  }
}

async function safeRateLimit(limiter, key, scope, ctx, capability) {
  if (!limiter?.limit) return { allowed: true, configured: false };

  try {
    const result = await limiter.limit({ key });
    return { allowed: result?.success !== false, configured: true };
  } catch (error) {
    logSafe(ctx, {
      type: "active_mirror_guardrail_degraded",
      surface: "rate_limit",
      scope,
      capability,
      reason: cleanProviderCode(error?.message || "rate_limit_error"),
    });
    return { allowed: true, configured: true, degraded: true };
  }
}

function requestActor(request) {
  const session = cleanActorKey(request.headers.get("X-Active-Mirror-Session"), "anonymous", 96);
  const forwarded = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0] || "";
  const network = cleanActorKey(forwarded, "unknown", 96);
  return { session, network };
}

function cleanActorKey(value, fallback, maxLength) {
  const clean = String(value || "")
    .replace(/[^a-zA-Z0-9_.:-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, maxLength);
  return clean || fallback;
}

function logSafe(ctx, payload) {
  const line = JSON.stringify({ ...payload, ts: new Date().toISOString() });
  if (ctx?.waitUntil) {
    ctx.waitUntil(Promise.resolve().then(() => console.log(line)));
    return;
  }
  console.log(line);
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

function sanitizeSourceCheckInput(body) {
  const intent = cleanSourceText(body?.intent, 1000);
  const question = cleanSourceText(body?.question, 240);
  const move = cleanSourceText(body?.move, 240);
  const boundary = String(body?.boundary || "personal").toLowerCase();
  const target = question || intent;
  if (target.length < 12) throw httpError(400, "source_question_required");
  return {
    intent,
    question: target,
    move,
    boundary: BOUNDARIES[boundary] ? boundary : "personal",
  };
}

function cleanSourceText(value, maxLength) {
  return String(value || "")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeRoute(value) {
  const route = String(value || "auto").toLowerCase();
  return ["reflection", "chat", "media"].includes(route) ? route : "auto";
}

// --- Routing: a runtime concern. Picks which provider/model answers a turn. ---
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
  return { capability: "reflection", primary: "openai", modelEnv: "OPENAI_REFLECTION_MODEL", defaultModel: "gpt-5.5" };
}

function chatRoute() {
  return { capability: "chat", primary: "openai", modelEnv: "OPENAI_REFLECTION_MODEL", defaultModel: "gpt-5.5" };
}

function mediaRoute() {
  return { capability: "media", primary: "gemini", modelEnv: "GEMINI_MEDIA_MODEL", defaultModel: "gemini-3.5-flash" };
}

// --- Provider calls. The kernel never sees any of this. Returns { fallback, fallbackReason, model, mirror }. ---
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

  return { fallback: true, fallbackReason: "no_provider_secret_configured", model: "local-deterministic", mirror: null };
}

async function fallbackResult(route, prompt, env, attempted, reason) {
  const fallbackRoute = chooseFallbackRoute(route, env, attempted);
  if (!fallbackRoute) {
    return { fallback: true, fallbackReason: reason, model: "local-deterministic", mirror: null };
  }
  try {
    const result = await runRoute(fallbackRoute, prompt, env, attempted);
    return { ...result, fallback: true, fallbackReason: reason };
  } catch {
    return { fallback: true, fallbackReason: reason, model: "local-deterministic", mirror: null };
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
      return { ...result, fallback: true, fallbackReason: `${providerFailureReason("openai", error)}_fast_model` };
    }
    throw error;
  }
}

async function callOpenAIModel(prompt, model, env) {
  const response = await fetchWithTimeout(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: prompt,
        store: false,
        reasoning: { effort: "low" },
        text: { format: { type: "json_schema", name: "active_mirror_turn", strict: true, schema: MIRROR_SCHEMA } },
        max_output_tokens: 1000,
      }),
    },
    "openai",
    env,
  );

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
        systemInstruction: { parts: [{ text: "Return a compact Active Mirror reflection as valid JSON only." }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseJsonSchema: PROVIDER_MIRROR_SCHEMA },
      }),
    },
    "gemini",
    env,
  );

  const data = await readProviderResponse(response, "gemini");
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  return { fallback: false, model, mirror: parseProviderMirror(text, "gemini") };
}

async function runSourceCheck(input, env) {
  if (!env.OPENAI_API_KEY) {
    return {
      fallback: true,
      answer: "Source checking is not available right now.",
      changes: "Do not rely on this claim until a source-backed check is run.",
      sources: [],
    };
  }

  return callOpenAISourceCheck(input, env);
}

async function callOpenAISourceCheck(input, env) {
  const model = env.OPENAI_RESEARCH_MODEL || env.OPENAI_FAST_MODEL || env.OPENAI_REFLECTION_MODEL || "gpt-5.4-mini";
  const prompt = [
    "You are Active Mirror's source checker.",
    "Use web search for current or external factual claims. Do not answer from memory.",
    "Return compact JSON only: answer, changes, sources.",
    "answer: one short answer with uncertainty if the evidence is mixed.",
    "changes: one sentence saying what this changes for the user's next move.",
    "sources: 2 to 5 web sources you actually used, each with title and url.",
    "Do not include private facts, personal history, or unsupported rankings.",
    "",
    `Original user intent: ${input.intent}`,
    `Mirror question to check: ${input.question}`,
    `Mirror next move: ${input.move || "not provided"}`,
  ].join("\n");
  const configuredTool = cleanProviderCode(env.OPENAI_WEB_SEARCH_TOOL || "");
  const toolTypes = [...new Set([configuredTool, "web_search_preview", "web_search"].filter(Boolean))];
  let lastError = null;

  for (const toolType of toolTypes) {
    try {
      const response = await fetchWithTimeout(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            input: prompt,
            store: false,
            tools: [{ type: toolType, search_context_size: "medium" }],
            tool_choice: "auto",
            text: { format: { type: "json_schema", name: "active_mirror_source_check", strict: true, schema: SOURCE_CHECK_SCHEMA } },
            max_output_tokens: 1200,
          }),
        },
        "openai",
        env,
      );
      const data = await readProviderResponse(response, "openai");
      const payload = parseSourceCheckPayload(extractOpenAIText(data));
      return normalizeSourceCheck(payload, extractSourceAnnotations(data));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("openai_source_check_failed");
}

function parseSourceCheckPayload(text) {
  const value = String(text || "").trim();
  if (!value) return {};
  const jsonText = value.startsWith("```") ? value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim() : value;
  try {
    return JSON.parse(jsonText);
  } catch {
    return { answer: value, changes: "Treat this as unchecked until sources are reviewed.", sources: [] };
  }
}

function normalizeSourceCheck(payload, annotations = []) {
  const payloadSources = Array.isArray(payload?.sources) ? payload.sources : [];
  const sources = uniqueSources([...payloadSources, ...annotations]).slice(0, 5);
  return {
    fallback: false,
    answer: cleanResearchText(payload?.answer, "The evidence needs a narrower check before relying on the claim.", 520),
    changes: cleanResearchText(payload?.changes, "Use this as a check on the next move, not as a final answer.", 260),
    sources,
  };
}

function cleanResearchText(value, fallback, maxLength) {
  const clean = String(value || "")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (clean || fallback).slice(0, maxLength);
}

function extractSourceAnnotations(data) {
  const found = [];
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.url === "string" && /^https?:\/\//i.test(value.url)) {
      found.push({ title: value.title || value.url, url: value.url });
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    for (const item of Object.values(value)) visit(item);
  };
  visit(data?.output);
  return uniqueSources(found);
}

function uniqueSources(items) {
  const seen = new Set();
  const sources = [];
  for (const item of items || []) {
    const url = String(item?.url || "").trim();
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    let fallbackTitle = url;
    try {
      fallbackTitle = new URL(url).hostname;
    } catch {}
    sources.push({
      title: cleanResearchText(item?.title, fallbackTitle, 140),
      url,
    });
  }
  return sources;
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

function maxMirrorRequestBytes(env) {
  const configured = Number(env.MAX_MIRROR_REQUEST_BYTES || DEFAULT_MIRROR_REQUEST_BYTES);
  if (!Number.isFinite(configured)) return DEFAULT_MIRROR_REQUEST_BYTES;
  return Math.max(2048, Math.min(64 * 1024, Math.trunc(configured)));
}

function maxEventRequestBytes(env) {
  const configured = Number(env.MAX_EVENT_REQUEST_BYTES || DEFAULT_EVENT_REQUEST_BYTES);
  if (!Number.isFinite(configured)) return DEFAULT_EVENT_REQUEST_BYTES;
  return Math.max(512, Math.min(8 * 1024, Math.trunc(configured)));
}

function rateWindowSeconds(env) {
  return clampNumber(env.MIRROR_RATE_WINDOW_SECONDS, 10, 300, DEFAULT_RATE_WINDOW_SECONDS);
}

function sessionWindowLimit(env) {
  return clampNumber(env.MIRROR_SESSION_WINDOW_LIMIT, 1, 1000, DEFAULT_SESSION_WINDOW_LIMIT);
}

function networkWindowLimit(env) {
  return clampNumber(env.MIRROR_NETWORK_WINDOW_LIMIT, 1, 5000, DEFAULT_NETWORK_WINDOW_LIMIT);
}

function eventWindowSeconds(env) {
  return clampNumber(env.EVENT_RATE_WINDOW_SECONDS, 10, 300, DEFAULT_EVENT_WINDOW_SECONDS);
}

function eventSessionWindowLimit(env) {
  return clampNumber(env.EVENT_SESSION_WINDOW_LIMIT, 10, 2000, DEFAULT_EVENT_SESSION_WINDOW_LIMIT);
}

function eventNetworkWindowLimit(env) {
  return clampNumber(env.EVENT_NETWORK_WINDOW_LIMIT, 20, 10000, DEFAULT_EVENT_NETWORK_WINDOW_LIMIT);
}

function clampNumber(value, min, max, fallback) {
  const configured = Number(value);
  if (!Number.isFinite(configured)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(configured)));
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
  return data.output?.flatMap((item) => item.content || [])?.find((item) => item.type === "output_text")?.text || "";
}

// --- Public route language (runtime owns route semantics; the kernel just prints what it's handed) ---
function publicRouteLabel(capability) {
  return { reflection: "reflection help", chat: "critique help", media: "media help" }[capability] || "approved help";
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
    source_check: {
      label: "source check",
      status: env.OPENAI_API_KEY ? "available" : "unavailable",
      purpose: "source-backed checks for current or external factual claims",
    },
  };
}

function publicGuardrails(env) {
  return {
    mirror_rate_limit: "enabled",
    event_rate_limit: "enabled",
    platform_rate_limit: env.MIRROR_SESSION_RATE_LIMITER || env.MIRROR_NETWORK_RATE_LIMITER ? "enabled" : "not_configured",
    daily_budget: "deferred",
    event_policy: "no-prompt-content",
    truth_state: "enabled",
    source_check: env.OPENAI_API_KEY ? "enabled" : "not_configured",
  };
}

function safeError(error) {
  return String(error?.message || "Unknown error").replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]");
}

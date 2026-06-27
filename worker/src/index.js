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
  sanitizeModelIntent,
} from "./mirror-kernel.js";

const ALLOWED_ORIGINS = new Set([
  "https://activemirror.ai",
  "https://www.activemirror.ai",
  "https://id.activemirror.ai",
  "https://mirrordna-reflection-protocol.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5180",
  "http://127.0.0.1:5180",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:8984",
  "http://127.0.0.1:8984",
  "http://localhost:8976",
  "http://127.0.0.1:8976",
]);

const WORKER_VERSION = "2026-06-27-mirrorseed-proof-v1";
const DEFAULT_PROVIDER_TIMEOUT_MS = 14000;
const DEFAULT_MIRROR_REQUEST_BYTES = 16 * 1024;
const DEFAULT_EVENT_REQUEST_BYTES = 2 * 1024;
const DEFAULT_RATE_WINDOW_SECONDS = 60;
const DEFAULT_SESSION_WINDOW_LIMIT = 12;
const DEFAULT_NETWORK_WINDOW_LIMIT = 36;
const DEFAULT_MIRROR_SESSION_DAILY_LIMIT = 80;
const DEFAULT_MIRROR_NETWORK_DAILY_LIMIT = 500;
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
  "proof_sprint_started",
  "proof_sprint_result",
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
  "workflow",
  "timeline",
]);

const PROOF_SPRINT_WORKFLOWS = new Set(["research", "approval", "ops", "unsure"]);
const PROOF_SPRINT_TIMELINES = new Set(["72h", "this_week", "exploring"]);
const PROOF_SPRINT_SOURCES = new Set(["hero", "final"]);
const PROOF_SPRINT_FIELDS = new Set(["reply_to", "workflow", "timeline", "source", "consent", "website"]);

const ENTERPRISE_RUNS = {
  research: {
    id: "research",
    label: "Research brief",
    request: "Turn a source pile into a board-ready brief.",
    output: "Brief outline, missing-evidence list, approval-ready next move.",
    risk: "medium",
    steps: [
      ["intake", "workflow received", "Only the selected files and brief are in scope.", "ok"],
      ["boundary", "private context held", "Unneeded names and side notes stay out.", "ok"],
      ["route", "research path selected", "Source-heavy claims require citation status.", "live"],
      ["check", "unsupported claims marked", "Two claims need stronger evidence before use.", "warn"],
      ["receipt", "proof pack ready", "Used, excluded, checked, and open items recorded.", "ok"],
    ],
  },
  approval: {
    id: "approval",
    label: "Approval memo",
    request: "Review an AI-generated memo before it goes to leadership.",
    output: "Risk notes, edits, approval state, and a clean decision trail.",
    risk: "high",
    steps: [
      ["intake", "memo opened", "The draft is readable, but not trusted yet.", "ok"],
      ["claim", "figures inspected", "Numbers without source records are held.", "block"],
      ["gate", "approval required", "External sharing is paused until a human approves.", "warn"],
      ["repair", "safer version produced", "Unsupported claims become questions or caveats.", "live"],
      ["receipt", "approval trail saved", "Reviewer, route, changes, and limits recorded.", "ok"],
    ],
  },
  ops: {
    id: "ops",
    label: "Agent run",
    request: "Let an agent prepare work without letting it act alone.",
    output: "Tool calls, blocked actions, files touched, and handoff notes.",
    risk: "controlled",
    steps: [
      ["start", "agent started", "Read-only prep run begins inside the boundary.", "live"],
      ["tools", "tools observed", "Search, file read, and draft actions are logged.", "ok"],
      ["block", "side effect blocked", "No external send or destructive action without approval.", "block"],
      ["handoff", "human checkpoint", "The next action waits for review.", "warn"],
      ["receipt", "run summarized", "What happened, what changed, and what is next are visible.", "ok"],
    ],
  },
};

const SOURCE_CHECK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "answer", "changes", "sources"],
  properties: {
    verdict: { type: "string", enum: ["supported", "mixed", "not_enough"] },
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

    if (request.method === "GET" && url.pathname === "/v1/mirror/enterprise-stream") {
      if (origin && !ALLOWED_ORIGINS.has(origin)) {
        return json({ ok: false, error: "origin_not_allowed" }, 403, corsHeaders);
      }
      return handleEnterpriseStream(request, env, ctx, corsHeaders);
    }

    if (request.method === "POST" && origin && !ALLOWED_ORIGINS.has(origin)) {
      return json({ ok: false, error: "origin_not_allowed" }, 403, corsHeaders);
    }

    if (request.method === "POST" && url.pathname === "/v1/events") {
      return handleEvent(request, env, ctx, corsHeaders);
    }

    if (request.method === "POST" && url.pathname === "/v1/mirror/proof-sprint") {
      return handleProofSprint(request, env, ctx, corsHeaders);
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

      if (result.fallback) {
        logSafe(ctx, {
          type: "active_mirror_provider_fallback",
          capability: route.capability,
          fallback: lastFallbackReason || "unknown",
          truth_state: result.truth_state?.status || "unknown",
        });
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

    const sourceInput = maskSourceCheckInput(input);
    const research = await runSourceCheck(sourceInput, env, ctx);
    const checked = research.sources.length > 0;
    const checkedLabel = {
      supported: "Source checked.",
      mixed: "Evidence mixed.",
      not_enough: "Not enough evidence.",
    }[research.verdict] || "Source checked.";
    const truth_state = checked
      ? {
          status: "checked",
          checked: true,
          label: checkedLabel,
          reason: "The source check returned cited web evidence for this turn.",
          signals: [`source_check_${research.verdict || "completed"}`],
        }
      : {
          status: "needs_checking",
          checked: false,
          label: "Needs sources before you rely on it.",
          reason: "No cited web evidence was returned.",
          signals: ["source_check_incomplete"],
        };
    const receipt_id = await receiptHash({ research, truth_state, intent: sourceInput.intent, question: sourceInput.question });

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

async function handleEnterpriseStream(request, env, ctx, corsHeaders) {
  const budget = await enforceEventBudget(request, env, ctx);
  if (!budget.allowed) {
    return rateLimitedResponse(budget, corsHeaders);
  }

  const url = new URL(request.url);
  const run = enterpriseRun(url.searchParams.get("run"));
  const intervalMs = enterpriseStreamIntervalMs(env);
  const encoder = new TextEncoder();

  logSafe(ctx, {
    type: "active_mirror_enterprise_stream",
    run: run.id,
    surface: "enterprise",
  });

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode("retry: 5000\n\n"));
      for (let index = 0; index < run.steps.length; index += 1) {
        controller.enqueue(encoder.encode(sseEvent("mirror.event", enterpriseStreamPayload(run, index))));
        if (intervalMs > 0 && index < run.steps.length - 1) {
          await sleep(intervalMs);
        }
      }
      controller.enqueue(encoder.encode(sseEvent("mirror.done", {
        ok: true,
        type: "enterprise_proof_done",
        run: publicEnterpriseRun(run),
        total: run.steps.length,
        source: "gateway_demo_stream",
      })));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      "X-Active-Mirror-Event-Policy": "public-demo-only",
    },
  });
}

async function handleProofSprint(request, env, ctx, corsHeaders) {
  try {
    const budget = await enforceEventBudget(request, env, ctx);
    if (!budget.allowed) {
      return rateLimitedResponse(budget, corsHeaders);
    }

    const body = await readJsonBody(request, maxEventRequestBytes(env));
    const requestData = sanitizeProofSprint(body);
    if (!requestData.ok) {
      return json(
        {
          ok: requestData.honeypot ? true : false,
          status: requestData.honeypot ? "received" : "rejected",
          error: requestData.honeypot ? undefined : requestData.error,
          policy: "metadata-only-contact",
        },
        requestData.honeypot ? 202 : 400,
        { ...corsHeaders, "X-Active-Mirror-Event-Policy": "metadata-only-contact" },
      );
    }

    const request_id = await proofSprintRequestId(requestData);
    const receipt_id = await receiptHash({
      type: "proof_sprint_request",
      request_id,
      workflow: requestData.workflow,
      timeline: requestData.timeline,
      source: requestData.source,
      reply_domain: requestData.reply_domain,
    });

    logSafe(ctx, {
      type: "active_mirror_proof_sprint_request",
      request_id,
      workflow: requestData.workflow,
      timeline: requestData.timeline,
      source: requestData.source,
      reply_domain: requestData.reply_domain,
    });

    return json(
      {
        ok: true,
        type: "proof_sprint_request",
        status: "received",
        request_id,
        receipt_id,
        policy: "metadata-only-contact",
        next: "Request receipt created. Send the prepared email to start; do not include workflow content until a scoped intake is agreed.",
      },
      202,
      { ...corsHeaders, "X-Active-Mirror-Event-Policy": "metadata-only-contact" },
    );
  } catch (error) {
    if (error?.status) {
      return json(
        { ok: false, error: error.code || "bad_request", policy: "metadata-only-contact" },
        error.status,
        { ...corsHeaders, "X-Active-Mirror-Event-Policy": "metadata-only-contact" },
      );
    }
    logSafe(ctx, { type: "active_mirror_gateway_error", surface: "proof_sprint", reason: safeError(error) });
    return json(
      { ok: false, error: "proof_sprint_error", policy: "metadata-only-contact" },
      500,
      { ...corsHeaders, "X-Active-Mirror-Event-Policy": "metadata-only-contact" },
    );
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

function enterpriseRun(value) {
  const key = cleanEventValue(value, 24);
  return ENTERPRISE_RUNS[key] || ENTERPRISE_RUNS.research;
}

function publicEnterpriseRun(run) {
  return {
    id: run.id,
    label: run.label,
    request: run.request,
    output: run.output,
    risk: run.risk,
  };
}

function enterpriseStreamPayload(run, index) {
  const [key, title, body, status] = run.steps[index];
  return {
    ok: true,
    type: "enterprise_proof_event",
    source: "gateway_demo_stream",
    run: publicEnterpriseRun(run),
    index,
    total: run.steps.length,
    progress: Math.round(((index + 1) / run.steps.length) * 100),
    route: "request.read -> boundary.check -> route.choose -> proof.mark -> human.approve",
    metrics: [
      { label: "Approval", value: "Human on", tone: "emerald" },
      { label: "Risk", value: run.risk, tone: run.risk === "high" ? "amber" : "cyan" },
      { label: "Memory", value: "choice", tone: "violet" },
      { label: "Sharing", value: "gated", tone: "emerald" },
    ],
    step: { key, title, body, status },
  };
}

function sseEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function enterpriseStreamIntervalMs(env) {
  const value = Number(env.ENTERPRISE_STREAM_INTERVAL_MS ?? 900);
  if (!Number.isFinite(value)) return 900;
  return Math.max(0, Math.min(2500, Math.trunc(value)));
}

function sanitizeProofSprint(body) {
  const keys = Object.keys(body || {});
  if (keys.some((key) => !PROOF_SPRINT_FIELDS.has(key))) {
    return { ok: false, error: "unexpected_field" };
  }

  if (String(body?.website || "").trim()) {
    return { ok: false, honeypot: true };
  }

  const rawBody = JSON.stringify(body || {});
  if (containsSecret(rawBody)) {
    return { ok: false, error: "boundary_violation" };
  }

  const reply_to = cleanContactEmail(body?.reply_to);
  if (!reply_to) return { ok: false, error: "email_required" };

  const workflow = cleanEventValue(body?.workflow, 24) || "unsure";
  const timeline = cleanEventValue(body?.timeline, 24) || "72h";
  const source = cleanEventValue(body?.source, 16) || "hero";

  if (!PROOF_SPRINT_WORKFLOWS.has(workflow)) return { ok: false, error: "workflow_not_allowed" };
  if (!PROOF_SPRINT_TIMELINES.has(timeline)) return { ok: false, error: "timeline_not_allowed" };
  if (!PROOF_SPRINT_SOURCES.has(source)) return { ok: false, error: "source_not_allowed" };
  if (body?.consent !== true) return { ok: false, error: "consent_required" };

  return {
    ok: true,
    reply_to,
    reply_domain: reply_to.split("@")[1] || "unknown",
    workflow,
    timeline,
    source,
  };
}

function cleanContactEmail(value) {
  const email = String(value || "").trim().toLowerCase().slice(0, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "";
  return email;
}

async function proofSprintRequestId(data) {
  const hash = await receiptHash({
    reply_to: data.reply_to,
    workflow: data.workflow,
    timeline: data.timeline,
    source: data.source,
    at: new Date().toISOString().slice(0, 16),
  });
  return `psr_${hash.slice(0, 16)}`;
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
    const outcome = await safeEdgeWindowLimit(check.key, check.limit, windowSeconds, check.scope, ctx, capability, rateLimitFailClosed(env));
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
    const outcome = await safeRateLimit(check.limiter, check.key, check.scope, ctx, capability, rateLimitFailClosed(env));
    if (!outcome.allowed) {
      logSafe(ctx, { type: "active_mirror_rate_limited", scope: check.scope, capability, window: "minute" });
      return { allowed: false, scope: check.scope, retryAfter: check.retryAfter };
    }
  }

  const dailyWindowSeconds = secondsUntilUtcMidnight();
  const dailyKey = utcDateKey();
  const dailyChecks = [
    {
      scope: "session_daily",
      key: `daily:${dailyKey}:session:${actor.session}`,
      limit: sessionDailyLimit(env),
      retryAfter: dailyWindowSeconds,
    },
    {
      scope: "network_daily",
      key: `daily:${dailyKey}:network:${actor.network}`,
      limit: networkDailyLimit(env),
      retryAfter: dailyWindowSeconds,
    },
  ];

  for (const check of dailyChecks) {
    const outcome = await safeEdgeWindowLimit(check.key, check.limit, dailyWindowSeconds, check.scope, ctx, "daily_budget", rateLimitFailClosed(env));
    if (!outcome.allowed) {
      logSafe(ctx, { type: "active_mirror_rate_limited", scope: check.scope, capability, window: "daily_budget" });
      return { allowed: false, scope: check.scope, retryAfter: outcome.retryAfter || check.retryAfter };
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
    const outcome = await safeEdgeWindowLimit(check.key, check.limit, windowSeconds, check.scope, ctx, "events", rateLimitFailClosed(env));
    if (!outcome.allowed) {
      logSafe(ctx, { type: "active_mirror_rate_limited", scope: check.scope, capability: "events", window: "edge_cache" });
      return { allowed: false, scope: check.scope, retryAfter: outcome.retryAfter || check.retryAfter };
    }
  }

  return { allowed: true };
}

async function safeEdgeWindowLimit(key, limit, windowSeconds, scope, ctx, capability, failClosed = true) {
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
    return { allowed: !failClosed, configured: true, degraded: true, retryAfter: windowSeconds };
  }
}

async function safeRateLimit(limiter, key, scope, ctx, capability, failClosed = true) {
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
    return { allowed: !failClosed, configured: true, degraded: true };
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

function rateLimitFailClosed(env) {
  return String(env.RATE_LIMIT_FAIL_CLOSED || "true").toLowerCase() !== "false";
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
  const intent = String(body?.intent || body?.input || "").replace(/\s+/g, " ").trim().slice(0, 1000);
  if (intent.length < 12) throw httpError(400, "intent_too_short");
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

function maskSourceCheckInput(input) {
  if (input.boundary !== "client") return input;
  return {
    ...input,
    intent: sanitizeModelIntent(input.intent, "client"),
    question: sanitizeModelIntent(input.question, "client"),
    move: sanitizeModelIntent(input.move, "client"),
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
  return { capability: "reflection", primary: "bridge", modelEnv: "MINI_REFLECTION_MODEL", defaultModel: "mini-mirror-bridge" };
}

function chatRoute() {
  return { capability: "chat", primary: "bridge", modelEnv: "MINI_REFLECTION_MODEL", defaultModel: "mini-mirror-bridge" };
}

function mediaRoute() {
  return { capability: "media", primary: "gemini", modelEnv: "GEMINI_MEDIA_MODEL", defaultModel: "gemini-3.5-flash" };
}

// --- Provider calls. The kernel never sees any of this. Returns { fallback, fallbackReason, model, mirror }. ---
async function runRoute(route, prompt, env, attempted = []) {
  const provider = route.primary;
  const nextAttempted = [...attempted, provider];

  try {
    if (provider === "bridge" && env.MIRROR_BRIDGE_URL && env.MIRROR_BRIDGE_TOKEN) {
      return await callBridge(prompt, route, env);
    }
    if (provider === "openai" && env.OPENAI_API_KEY) {
      return await callOpenAI(prompt, route, env);
    }
    if (provider === "anthropic" && env.ANTHROPIC_API_KEY) {
      return await callAnthropic(prompt, route, env);
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
  if (!attempted.includes("bridge") && route.primary !== "bridge" && env.MIRROR_BRIDGE_URL && env.MIRROR_BRIDGE_TOKEN) {
    return { ...route, primary: "bridge", modelEnv: "MINI_REFLECTION_MODEL", defaultModel: "mini-mirror-bridge" };
  }
  if (!attempted.includes("anthropic") && route.primary !== "anthropic" && env.ANTHROPIC_API_KEY) {
    return { ...route, primary: "anthropic", modelEnv: "ANTHROPIC_REFLECTION_MODEL", defaultModel: "claude-sonnet-4-5" };
  }
  if (!attempted.includes("openai") && route.primary !== "openai" && env.OPENAI_API_KEY) {
    return { ...route, primary: "openai", modelEnv: "OPENAI_REFLECTION_MODEL", defaultModel: "gpt-5.5" };
  }
  if (!attempted.includes("gemini") && route.primary !== "gemini" && (env.GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER || env.GEMINI_API_KEY)) {
    return { ...route, primary: "gemini", modelEnv: "GEMINI_MEDIA_MODEL", defaultModel: "gemini-3.5-flash" };
  }
  return null;
}

async function callBridge(prompt, route, env) {
  const response = await fetchWithTimeout(
    `${String(env.MIRROR_BRIDGE_URL).replace(/\/+$/, "")}/v1/mirror/reflect`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Active-Mirror-Bridge": env.MIRROR_BRIDGE_TOKEN,
      },
      body: JSON.stringify({ prompt, route: route.capability }),
    },
    "bridge",
    env,
  );

  const data = await readProviderResponse(response, "bridge");
  if (!data?.ok || !data?.mirror) throw new Error("bridge_invalid_mirror");
  return { fallback: false, model: data.model || "mini-mirror-bridge", mirror: data.mirror };
}

async function callAnthropic(prompt, route, env) {
  const preferredModel = env[route.modelEnv] || env.ANTHROPIC_REFLECTION_MODEL || "claude-sonnet-4-5";
  const fallbackModels = String(env.ANTHROPIC_FALLBACK_MODELS || "claude-3-5-sonnet-20241022,claude-3-haiku-20240307")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const models = [...new Set([preferredModel, ...fallbackModels])];
  let lastError;
  for (const model of models) {
    try {
      return await callAnthropicModel(prompt, model, env);
    } catch (error) {
      lastError = error;
      if (!shouldTryAnthropicFallback(error)) break;
    }
  }
  throw lastError || new Error("anthropic_provider_error");
}

function shouldTryAnthropicFallback(error) {
  const message = String(error?.message || "");
  return (
    message.startsWith("anthropic_provider_400") ||
    message.startsWith("anthropic_provider_403") ||
    message.startsWith("anthropic_provider_404") ||
    message.startsWith("anthropic_provider_429") ||
    message.startsWith("anthropic_provider_503") ||
    message.startsWith("anthropic_timeout")
  );
}

async function callAnthropicModel(prompt, model, env) {
  const response = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": env.ANTHROPIC_VERSION || "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        temperature: 0.4,
        system: "Return one compact Active Mirror reflection as valid JSON only. No markdown, no preamble, no prose outside JSON.",
        messages: [{ role: "user", content: prompt }],
      }),
    },
    "anthropic",
    env,
  );

  const data = await readProviderResponse(response, "anthropic");
  return { fallback: false, model, mirror: parseProviderMirror(extractAnthropicText(data), "anthropic") };
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

async function runSourceCheck(input, env, ctx) {
  if (!env.OPENAI_API_KEY) {
    if (env.GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER || env.GEMINI_API_KEY) {
      return callGeminiSourceCheck(input, env, ctx);
    }
    return {
      fallback: true,
      answer: "Source checking is not available right now.",
      changes: "Do not rely on this claim until a source-backed check is run.",
      sources: [],
    };
  }

  try {
    return await callOpenAISourceCheck(input, env);
  } catch (error) {
    if (env.GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER || env.GEMINI_API_KEY) {
      logSafe(ctx, {
        type: "active_mirror_source_check_fallback",
        from: "primary",
        to: "backup",
        reason: providerFailureReason("openai", error),
      });
      try {
        return await callGeminiSourceCheck(input, env, ctx);
      } catch (fallbackError) {
        return makeSourceCheckPlan(input, fallbackError);
      }
    }
    return makeSourceCheckPlan(input, error);
  }
}

async function callOpenAISourceCheck(input, env) {
  const model = env.OPENAI_RESEARCH_MODEL || env.OPENAI_FAST_MODEL || env.OPENAI_REFLECTION_MODEL || "gpt-5.4-mini";
  const prompt = [
    "You are Active Mirror's source checker.",
    "Use web search for current or external factual claims. Do not answer from memory.",
    "Return compact JSON only: verdict, answer, changes, sources.",
    "verdict: supported, mixed, or not_enough.",
    "Use supported only when sources directly support the narrow claim.",
    "Use mixed when the evidence is real but ambiguous, incomplete, or split.",
    "Use not_enough when you cannot find enough reliable current evidence.",
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

async function callGeminiSourceCheck(input, env, ctx) {
  const models = [
    env.GEMINI_SOURCE_MODEL,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    env.GEMINI_MEDIA_MODEL,
  ].filter(Boolean);
  const modelCandidates = [...new Set(models)];
  const toolCandidates = [[{ googleSearch: {} }], [{ googleSearchRetrieval: {} }]];
  const key = env.GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER || env.GEMINI_API_KEY;
  const referer = env.GEMINI_ALLOWED_REFERER || "https://activemirror.ai/";
  const prompt = [
    "You are Active Mirror's backup source checker.",
    "Use Google Search grounding for current or external factual claims. Do not answer from memory.",
    "Return compact JSON only: verdict, answer, changes, sources.",
    "verdict: supported, mixed, or not_enough.",
    "Use supported only when sources directly support the narrow claim.",
    "Use mixed when the evidence is real but ambiguous, incomplete, or split.",
    "Use not_enough when you cannot find enough reliable current evidence.",
    "answer: one short answer with uncertainty if the evidence is mixed.",
    "changes: one sentence saying what this changes for the user's next move.",
    "sources: 2 to 5 web sources you actually used, each with title and url.",
    "Do not include private facts, personal history, or unsupported rankings.",
    "",
    `Original user intent: ${input.intent}`,
    `Mirror question to check: ${input.question}`,
    `Mirror next move: ${input.move || "not provided"}`,
  ].join("\n");

  let lastError = null;
  for (const model of modelCandidates) {
    for (const tools of toolCandidates) {
      try {
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
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              tools,
              generationConfig: { temperature: 0.1, maxOutputTokens: 1200 },
            }),
          },
          "gemini",
          env,
        );

        const data = await readProviderResponse(response, "gemini");
        const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
        const payload = parseSourceCheckPayload(text);
        return { ...normalizeSourceCheck(payload, extractGeminiSourceAnnotations(data)), fallback: true };
      } catch (error) {
        lastError = error;
        logSafe(ctx, {
          type: "active_mirror_source_check_backup_failed",
          provider: "backup",
          model: cleanProviderCode(model),
          tool: Object.keys(tools?.[0] || {})[0] || "none",
          reason: providerFailureReason("gemini", error),
        });
      }
    }
  }

  throw lastError || new Error("gemini_source_check_failed");
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
  const sources = rankSourcesByQuality(uniqueSources([...payloadSources, ...annotations])).slice(0, 5);
  const answer = cleanResearchText(payload?.answer, "The evidence needs a narrower check before relying on the claim.", 520);
  const changes = cleanResearchText(payload?.changes, "Use this as a check on the next move, not as a final answer.", 260);
  const verdict = normalizeSourceVerdict(payload?.verdict, answer, sources);
  const source_quality = summarizeSourceQuality(sources);
  return {
    fallback: false,
    verdict,
    answer,
    changes,
    source_quality,
    sources,
  };
}

function makeSourceCheckPlan(input, error) {
  const narrow = cleanResearchText(input.question || input.intent, "the claim", 160);
  const query = `"${narrow.replace(/"/g, "")}"`;
  return {
    fallback: true,
    verdict: "not_enough",
    answer: "The source route could not fetch reliable citations from this edge right now.",
    changes: "Do not rely on this claim yet; use the verification plan before turning it into a conclusion.",
    source_quality: {
      best_score: 0,
      high_quality_count: 0,
      weak_count: 0,
      count: 0,
    },
    sources: [],
    verification_plan: {
      status: "needs_sources",
      reason: publicFallbackReason(providerFailureReason("source", error)),
      queries: [
        query,
        `${query} official docs`,
        `${query} research paper`,
      ].slice(0, 3),
      prefer: ["official documentation", "primary company pages", "research or standards sources"],
      avoid: ["unsourced rankings", "listicles without primary links", "social posts without evidence"],
    },
  };
}

function normalizeSourceVerdict(value, answer, sources) {
  const verdict = String(value || "").toLowerCase().replace(/[^a-z_]/g, "");
  if (verdict === "not_enough") return "not_enough";
  if (!sources.length) return "not_enough";

  const text = String(answer || "").toLowerCase();
  if (/\b(not enough|insufficient|cannot verify|can't verify|could not verify|no reliable|no authoritative|no clear source|no source|not found)\b/.test(text)) {
    return "not_enough";
  }
  if (/\b(mixed|ambiguous|split|unclear|not clear|no single|not a clear|depends|insufficient to rank)\b/.test(text)) {
    return "mixed";
  }
  const strongSources = sources.filter((source) => Number(source.quality_score || 0) >= 80).length;
  if (verdict === "supported" && strongSources < 1) return "mixed";
  if (verdict === "supported") return "supported";
  if (verdict === "mixed") return "mixed";
  if (sources.length >= 2 && strongSources >= 1) return "supported";
  return "mixed";
}

function cleanResearchText(value, fallback, maxLength) {
  const clean = String(value || "")
    .replace(/\[([^\]]{1,160})\]\(https?:\/\/[^\s)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+\)/g, ")")
    .replace(/\(\s*\)/g, "")
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

function extractGeminiSourceAnnotations(data) {
  const found = [];
  for (const candidate of data?.candidates || []) {
    const metadata = candidate?.groundingMetadata || {};
    for (const chunk of metadata.groundingChunks || []) {
      const url = chunk?.web?.uri;
      if (/^https?:\/\//i.test(url || "")) {
        found.push({ title: chunk.web.title || url, url });
      }
    }
    for (const item of metadata.groundingSupports || []) {
      for (const chunkIndex of item?.groundingChunkIndices || []) {
        const chunk = metadata.groundingChunks?.[chunkIndex];
        const url = chunk?.web?.uri;
        if (/^https?:\/\//i.test(url || "")) {
          found.push({ title: chunk.web.title || url, url });
        }
      }
    }
  }
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
      ...classifySource(url, item?.title),
    });
  }
  return sources;
}

function rankSourcesByQuality(sources = []) {
  return [...sources].sort((a, b) => Number(b.quality_score || 0) - Number(a.quality_score || 0));
}

function classifySource(url, title = "") {
  let host = "";
  let path = "";
  try {
    const parsed = new URL(url);
    host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    path = parsed.pathname.toLowerCase();
  } catch {}

  const labelText = `${title || ""} ${url}`.toLowerCase();
  const officialVendorHost =
    /(^|\.)openai\.com$|(^|\.)anthropic\.com$|(^|\.)google\.com$|(^|\.)googleblog\.com$|(^|\.)microsoft\.com$|(^|\.)apple\.com$|(^|\.)cloudflare\.com$|(^|\.)huggingface\.co$|(^|\.)vercel\.com$|(^|\.)figma\.com$|(^|\.)replit\.com$|(^|\.)lovable\.dev$|(^|\.)uizard\.io$|(^|\.)flutterflow\.io$/.test(host);
  const docsOrDeveloper = /(^docs\.|^developer\.|^developers\.|^platform\.)/.test(host) || /\/(docs|developers?|reference|api|guides?|blog\/developer|engineering)\b/.test(path);
  const researchHost = /(^|\.)arxiv\.org$|(^|\.)acm\.org$|(^|\.)ieee\.org$|(^|\.)nature\.com$|(^|\.)science\.org$|(^|\.)edu$|(^|\.)gov$/.test(host);
  const listicle = /\b(best|top|alternatives?|vs\.?|versus|pricing|review|reviews|compared?|comparison|i tested|tools for)\b/.test(labelText) || /\b\d+\s+(?:best|top)\b/.test(labelText);
  const weakHost = /(^|\.)medium\.com$|(^|\.)substack\.com$|(^|\.)reddit\.com$|(^|\.)quora\.com$|(^|\.)x\.com$|(^|\.)twitter\.com$|(^|\.)linkedin\.com$/.test(host);

  if (officialVendorHost && docsOrDeveloper) {
    return {
      quality: "primary_docs",
      quality_label: "Primary docs",
      quality_score: 95,
      quality_reason: "Official developer or documentation source.",
    };
  }
  if (officialVendorHost) {
    return {
      quality: "official_source",
      quality_label: "Official source",
      quality_score: 90,
      quality_reason: "Official product or company source.",
    };
  }
  if (researchHost) {
    return {
      quality: "credible_analysis",
      quality_label: "Research",
      quality_score: 82,
      quality_reason: "Research, standards, academic, or public institution source.",
    };
  }
  if (weakHost) {
    return {
      quality: "weak_source",
      quality_label: "Weak source",
      quality_score: 35,
      quality_reason: "Social, forum, or personal publishing source.",
    };
  }
  if (listicle) {
    return {
      quality: "listicle_or_vendor",
      quality_label: "Secondary list",
      quality_score: 55,
      quality_reason: "Listicle, comparison, review, or vendor-adjacent page.",
    };
  }
  return {
    quality: "secondary_source",
    quality_label: "Secondary source",
    quality_score: 65,
    quality_reason: "General web source; useful context but not primary proof.",
  };
}

function summarizeSourceQuality(sources = []) {
  const scores = sources.map((source) => Number(source.quality_score || 0));
  const best_score = scores.length ? Math.max(...scores) : 0;
  const high_quality_count = sources.filter((source) => Number(source.quality_score || 0) >= 80).length;
  const weak_count = sources.filter((source) => Number(source.quality_score || 0) < 60).length;
  return {
    best_score,
    high_quality_count,
    weak_count,
    count: sources.length,
  };
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

function sessionDailyLimit(env) {
  return clampNumber(env.MIRROR_SESSION_DAILY_LIMIT, 1, 10000, DEFAULT_MIRROR_SESSION_DAILY_LIMIT);
}

function networkDailyLimit(env) {
  return clampNumber(env.MIRROR_NETWORK_DAILY_LIMIT, 1, 100000, DEFAULT_MIRROR_NETWORK_DAILY_LIMIT);
}

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function secondsUntilUtcMidnight(now = new Date()) {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(60, Math.ceil((next.getTime() - now.getTime()) / 1000));
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

function extractAnthropicText(data) {
  const blocks = Array.isArray(data?.content) ? data.content : [];
  return blocks
    .map((block) => {
      if (typeof block?.text === "string") return block.text;
      if (block?.type === "tool_use" && block?.input) return JSON.stringify(block.input);
      return "";
    })
    .join("")
    .trim();
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
    .replace(/bridge/gi, "local")
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
      status: (env.MIRROR_BRIDGE_URL && env.MIRROR_BRIDGE_TOKEN) || env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY ? "available" : "browser fallback",
      purpose: "reflective reasoning and first-use mirror generation",
    },
    chat: {
      label: "critique help",
      status: (env.MIRROR_BRIDGE_URL && env.MIRROR_BRIDGE_TOKEN) || env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY ? "available" : "browser fallback",
      purpose: "chat polish, critique, rewrite, and receipt review",
    },
    media: {
      label: "media help",
      status: env.GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER || env.GEMINI_API_KEY ? "available" : "browser fallback",
      purpose: "images, video, multimodal understanding, and media assets",
    },
    source_check: {
      label: "source check",
      status: hasSourceCheckRoute(env) ? "available" : "unavailable",
      purpose: "source-backed checks for current or external factual claims",
    },
    enterprise_stream: {
      label: "enterprise proof stream",
      status: "available",
      purpose: "public demo stream for governed work, approvals, and receipt states",
    },
    proof_sprint: {
      label: "proof sprint request",
      status: "available",
      purpose: "metadata-only contact request for a scoped enterprise proof sprint",
    },
  };
}

function publicGuardrails(env) {
  return {
    mirror_rate_limit: "enabled",
    event_rate_limit: "enabled",
    platform_rate_limit: env.MIRROR_SESSION_RATE_LIMITER || env.MIRROR_NETWORK_RATE_LIMITER ? "enabled" : "not_configured",
    daily_budget: "enabled",
    daily_session_limit: String(sessionDailyLimit(env)),
    daily_network_limit: String(networkDailyLimit(env)),
    event_policy: "no-prompt-content",
    enterprise_stream_policy: "public-demo-only",
    proof_sprint_policy: "metadata-only-contact",
    truth_state: "enabled",
    source_check: hasSourceCheckRoute(env) ? "enabled" : "not_configured",
  };
}

function hasSourceCheckRoute(env) {
  return Boolean(env.OPENAI_API_KEY || env.GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER || env.GEMINI_API_KEY);
}

function safeError(error) {
  return String(error?.message || "Unknown error").replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]");
}

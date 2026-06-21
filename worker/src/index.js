const ALLOWED_ORIGINS = new Set([
  "https://activemirror.ai",
  "https://www.activemirror.ai",
  "https://mirrordna-reflection-protocol.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

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
  required: ["goals", "blockers", "moves", "artifact", "receipt"],
  properties: {
    goals: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string", minLength: 3, maxLength: 96 },
    },
    blockers: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string", minLength: 3, maxLength: 110 },
    },
    moves: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: { type: "string", minLength: 3, maxLength: 120 },
    },
    artifact: {
      type: "object",
      additionalProperties: false,
      required: ["title", "summary"],
      properties: {
        title: { type: "string", minLength: 3, maxLength: 72 },
        summary: { type: "string", minLength: 8, maxLength: 140 },
      },
    },
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

      const route = selectRoute(input.intent);
      const prompt = buildPrompt(input, boundary, route);
      const result = await runRoute(route, prompt, env);
      const mirror = normalizeMirror(result.mirror, input, boundary, route, result);
      const receiptId = await receiptHash({ mirror, route, turn: input.turn });

      return json(
        {
          ok: true,
          fallback: result.fallback,
          receipt_id: receiptId,
          mirror,
          route: {
            capability: route.capability,
            primary: route.primary,
            model: result.model,
            fallback: result.fallbackReason || null,
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
    turn: Number.isFinite(body?.turn) ? Math.max(1, Math.min(9999, Math.trunc(body.turn))) : 1,
  };
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

function selectRoute(intent) {
  const value = intent.toLowerCase();
  if (/\b(image|visual|video|poster|screenshot|render|asset|thumbnail|media)\b/.test(value)) {
    return {
      capability: "media",
      primary: "gemini",
      modelEnv: "GEMINI_MEDIA_MODEL",
      defaultModel: "gemini-3.5-flash",
    };
  }

  if (/\b(chat|rewrite|tone|copy|critique|review|polish)\b/.test(value)) {
    return {
      capability: "chat",
      primary: "anthropic",
      modelEnv: "ANTHROPIC_CHAT_MODEL",
      defaultModel: "claude-sonnet-4-6",
    };
  }

  return {
    capability: "reflection",
    primary: "openai",
    modelEnv: "OPENAI_REFLECTION_MODEL",
    defaultModel: "gpt-5.5",
  };
}

function buildPrompt(input, boundary, route) {
  return [
    "You are Active Mirror. Reflect before predicting.",
    "Return only compact JSON matching the requested structure.",
    "No therapy claims. No personal-data collection. No hallucinated facts.",
    "Create a first-use action board from the user's intent.",
    `Capability route: ${route.capability} via ${route.primary}.`,
    `Boundary: ${input.boundary}.`,
    `Context excluded: ${boundary.excluded}`,
    `Memory decision rule: ${boundary.memory}`,
    "",
    `Intent: ${input.intent}`,
  ].join("\n");
}

async function runRoute(route, prompt, env) {
  if (route.primary === "openai" && env.OPENAI_API_KEY) {
    return callOpenAI(prompt, route, env);
  }
  if (route.primary === "anthropic" && env.ANTHROPIC_API_KEY) {
    return callAnthropic(prompt, route, env);
  }
  if (route.primary === "gemini" && (env.GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER || env.GEMINI_API_KEY)) {
    return callGemini(prompt, route, env);
  }

  const fallbackRoute =
    route.primary !== "openai" && env.OPENAI_API_KEY
      ? { ...route, primary: "openai", modelEnv: "OPENAI_REFLECTION_MODEL", defaultModel: "gpt-5.5" }
      : route.primary !== "anthropic" && env.ANTHROPIC_API_KEY
        ? { ...route, primary: "anthropic", modelEnv: "ANTHROPIC_CHAT_MODEL", defaultModel: "claude-sonnet-4-6" }
        : null;

  if (fallbackRoute) {
    const result = await runRoute(fallbackRoute, prompt, env);
    return { ...result, fallbackReason: `${route.primary}_missing_secret` };
  }

  return {
    fallback: true,
    fallbackReason: "no_provider_secret_configured",
    model: "local-deterministic",
    mirror: null,
  };
}

async function callOpenAI(prompt, route, env) {
  const model = env[route.modelEnv] || route.defaultModel;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      store: false,
      reasoning: { effort: "medium" },
      text: {
        format: {
          type: "json_schema",
          name: "active_mirror_turn",
          strict: true,
          schema: MIRROR_SCHEMA,
        },
      },
      max_output_tokens: 1800,
    }),
  });

  const data = await readProviderResponse(response, "openai");
  return { fallback: false, model, mirror: parseMirror(extractOpenAIText(data)) };
}

async function callAnthropic(prompt, route, env) {
  const model = env[route.modelEnv] || route.defaultModel;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1800,
      system: "Return only valid JSON matching the Active Mirror first-use board structure.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await readProviderResponse(response, "anthropic");
  const text = data.content?.find((item) => item.type === "text")?.text || "";
  return { fallback: false, model, mirror: parseMirror(text) };
}

async function callGemini(prompt, route, env) {
  const model = env[route.modelEnv] || route.defaultModel;
  const key = env.GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER || env.GEMINI_API_KEY;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" },
      }),
    },
  );

  const data = await readProviderResponse(response, "gemini");
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  return { fallback: false, model, mirror: parseMirror(text) };
}

async function readProviderResponse(response, provider) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${provider}_provider_${response.status}`);
  }
  return data;
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

function normalizeMirror(candidate, input, boundary, route, result) {
  const fallback = deterministicMirror(input, boundary, route, result);
  if (!candidate || typeof candidate !== "object") return fallback;

  return {
    goals: normalizeList(candidate.goals, fallback.goals, 3),
    blockers: normalizeList(candidate.blockers, fallback.blockers, 3),
    moves: normalizeList(candidate.moves, fallback.moves, 4),
    artifact: {
      title: cleanText(candidate.artifact?.title, fallback.artifact.title, 72),
      summary: cleanText(candidate.artifact?.summary, fallback.artifact.summary, 140),
    },
    receipt: {
      why: cleanText(candidate.receipt?.why, fallback.receipt.why, 220),
      context_used: cleanText(candidate.receipt?.context_used, fallback.receipt.context_used, 220),
      context_excluded: cleanText(candidate.receipt?.context_excluded, fallback.receipt.context_excluded, 220),
      route: cleanText(candidate.receipt?.route, fallback.receipt.route, 220),
      memory_decision: cleanText(candidate.receipt?.memory_decision, fallback.receipt.memory_decision, 220),
    },
  };
}

function normalizeList(value, fallback, size) {
  const list = Array.isArray(value) ? value.map((item) => cleanText(item, "", 120)).filter(Boolean) : [];
  return [...list, ...fallback].slice(0, size);
}

function cleanText(value, fallback, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return (text || fallback).slice(0, maxLength);
}

function deterministicMirror(input, boundary, route, result) {
  const value = input.intent.toLowerCase();
  const isRestart = /\b(restart|stuck|return|overwhelm|scattered)\b/.test(value);
  const isResearch = /\b(research|source|study|memo|claim)\b/.test(value);
  const isCareer = /\b(career|job|offer|portfolio)\b/.test(value);

  const base = isCareer
    ? {
        goals: ["Extract repeatable strengths", "Package a clear offer", "Ship one portfolio proof"],
        blockers: ["Story is too broad", "Past work is under-leveraged", "No proof sprint selected"],
        moves: ["Name three strengths", "Map each strength to evidence", "Build one proof artifact", "Track response signals"],
        artifact: { title: "Offer proof map", summary: "Strength, evidence, offer, and proof sprint." },
        why: "The turn needs a bridge from lived work to visible proof and commercial motion.",
      }
    : isResearch
      ? {
          goals: ["Turn findings into decisions", "Expose assumptions", "Attach source receipts"],
          blockers: ["Claims are mixed with guesses", "Contradictions are hidden", "Sources are not ranked"],
          moves: ["Cluster claims", "Mark evidence strength", "List contradictions", "Generate the decision memo"],
          artifact: { title: "Research synthesis memo", summary: "Claim, source, contradiction, and decision." },
          why: "The research needs a structured view with receipts, not a longer chat answer.",
        }
      : isRestart
        ? {
            goals: ["Recover useful past work", "Lower the restart load", "Create one proof of motion"],
            blockers: ["Old context is scattered", "Restart friction is high", "Progress is hard to see"],
            moves: ["Sort open loops", "Retire stale threads", "Choose a 48-hour win", "Save the momentum receipt"],
            artifact: { title: "Return path board", summary: "What still matters, what can go, and what moves first." },
            why: "The work needs continuity without reliving every detail.",
          }
        : {
            goals: ["Define the audience promise", "Choose the first visible proof", "Ship a testable launch page"],
            blockers: ["Scattered notes", "Too many possible angles", "No receipt trail for claims"],
            moves: ["Extract the strongest promise", "Pick three proof assets", "Write the user-test script", "Promote only validated copy"],
            artifact: { title: "Launch clarity memo", summary: "Audience, promise, proof, and next test." },
            why: "The work needs a visible product story and a next action, not more brainstorming.",
          };

  return {
    ...base,
    receipt: {
      why: base.why,
      context_used: `Intent summary plus the selected ${input.boundary} boundary.`,
      context_excluded: boundary.excluded,
      route: result.fallback
        ? `Local deterministic fallback because ${result.fallbackReason || "the provider route was unavailable"}.`
        : `${route.capability} route via ${route.primary}; model output normalized by Active Mirror.`,
      memory_decision: boundary.memory,
    },
  };
}

async function receiptHash(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

function publicRoutes(env) {
  return {
    reflection: {
      primary: "openai",
      model: env.OPENAI_REFLECTION_MODEL || "gpt-5.5",
      purpose: "reflective reasoning and first-use mirror generation",
    },
    chat: {
      primary: "anthropic",
      model: env.ANTHROPIC_CHAT_MODEL || "claude-sonnet-4-6",
      purpose: "chat polish, critique, rewrite, and receipt review",
    },
    media: {
      primary: "gemini",
      model: env.GEMINI_MEDIA_MODEL || "gemini-3.5-flash",
      image_model: env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
      video_model: env.GEMINI_VIDEO_MODEL || "veo-3.1-fast-generate-preview",
      purpose: "images, video, multimodal understanding, and media assets",
    },
  };
}

function safeError(error) {
  return String(error?.message || "Unknown error").replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]");
}

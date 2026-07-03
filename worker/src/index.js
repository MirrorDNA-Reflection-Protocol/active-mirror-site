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
  ACTIVE_MIRROR_BOOT_VERSION,
  BOUNDARIES,
  MIRROR_SCHEMA,
  PROVIDER_MIRROR_SCHEMA,
  containsSecret,
  parseProviderMirror,
  receiptHash,
  reflect,
  sanitizeModelIntent,
} from "./mirror-kernel.js";
import {
  ACTIVE_MIRROR_IDENTITY_CAPSULE_VERSION,
  ACTIVE_MIRROR_IDENTITY_SOURCE_HASH,
  ACTIVE_MIRROR_IDENTITY_SOURCES,
} from "./identity-capsule.js";

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

const WORKER_VERSION = "2026-07-03-second-turn-v1";
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
  "saved_choices_uploaded",
  "saved_choices_upload_failed",
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

const SOURCE_TOOL_ALLOWLIST = {
  openai: ["web_search", "web_search_preview"],
  gemini: ["google_search", "google_search_retrieval"],
};

const ACTIVE_MIRROR_ALGORITHM = {
  id: "mirror_loop_v1",
  ethos: "trust_by_design_or_hardstop",
  invariant: "truth_before_helpfulness",
  ratchet: "perfection_as_ratchet",
  steps: [
    "boundary",
    "consent",
    "source_truth",
    "route",
    "reflect",
    "challenge",
    "one_move",
    "receipt",
    "learning_candidate",
  ],
};

const RECURSIVE_PERFECTION_LOCK = {
  id: "recursive_perfection_lock_v1",
  definition: "no_known_gap_without_resolution_contract",
  loop: ["observe", "reflect", "source_check", "harden", "verify", "promote", "repeat"],
  stop_condition: "operator_hardstop_or_no_safe_local_action_with_resolution_contract",
};

const RESOLUTION_POLICY = {
  id: "resolution_contract_v1",
  rule: "no_negative_state_without_fix_path",
};

const PROMOTION_POLICY = {
  id: "reflection_promotion_v1",
  training: "amendable_after_reflection",
  reverse_abliteration: "strengthen_reflection_refusal_source_truth_and_boundary_directions",
  allowed_targets: ["docs", "tests", "guardrails", "backlog", "source_queries", "memory_candidates", "adapter_candidates"],
  blocked_targets_without_approval: ["model_weights", "lora_promotion", "training_data_promotion", "production_deploy", "external_write"],
  proof: "source_evidence_local_receipt_eval_or_explicit_approval",
};

const COUNCIL_CONTROL_PLANE = {
  id: "active_mirror_council_control_plane_v1",
  route: "intent_router_to_council_to_receipt_to_promotion_gate",
  councils: ["thread", "source", "runtime", "ops", "design", "security", "state", "promotion"],
  promotion_gate: PROMOTION_POLICY.id,
  hardstop: ACTIVE_MIRROR_ALGORITHM.ethos,
};

const ARTIFACT_KINDS = new Set(["doc", "code", "image", "draft"]);
const ARTIFACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "title", "body", "checklist"],
  properties: {
    kind: { type: "string", enum: ["doc", "code", "image", "draft"] },
    title: { type: "string" },
    body: { type: "string" },
    checklist: {
      type: "array",
      maxItems: 4,
      items: { type: "string" },
    },
  },
};

const UNSAFE_ARTIFACT_RE =
  /\b(?:malware|ransomware|phishing|steal credentials|credential theft|bypass security|evade detection|exfiltrate|keylogger|ddos|sql injection|exploit|forge documents|hide evidence|destroy evidence|launder money)\b/i;
const WEAK_ARTIFACT_RE =
  /\b(?:i can help|i can create|i can draft|here'?s how|here is how|you could|you should|you may want to|consider (?:writing|adding|including)|steps? to create|template for)\b/i;
const ARTIFACT_INTERNAL_RE =
  /\b(?:provider|gateway|model route|internal token|policy|receipt id|hash chain)\b/i;

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
          identity: publicIdentityCapsule(),
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

    if (request.method === "POST" && url.pathname === "/v1/mirror/artifact") {
      return handleArtifact(request, env, ctx, corsHeaders);
    }

    if (request.method !== "POST" || url.pathname !== "/v1/mirror/create") {
      return json({ ok: false, error: "not_found" }, 404, corsHeaders);
    }

    try {
      const body = await readJsonBody(request, maxMirrorRequestBytes(env));
      const input = sanitizeInput(body);
      const route = selectRoute(input.intent, input.route, env);
      const failsafe = gatewayFailsafeMode(env);
      const budget = await enforceMirrorBudget(request, env, ctx, route);
      if (!budget.allowed) {
        return rateLimitedResponse(budget, corsHeaders);
      }

      // The only thing the runtime injects into the kernel: how to call a model.
      let lastFallbackReason = null;
      let lastInternalFallbackReason = null;
      let lastProvider = null;
      let lastModel = null;
      let lastUpstreamHost = null;
      let lastAttempts = [];
      let lastPromptHash = null;
      let lastPromptChars = 0;
      const result = await reflect({
        intent: input.intent,
        boundary: input.boundary,
        turn: input.turn,
        capability: route.capability,
        mode: input.mode,
        callModel: async (prompt) => {
          lastPromptHash = await receiptHash({
            type: "active_mirror_prompt",
            boot: ACTIVE_MIRROR_BOOT_VERSION,
            capability: route.capability,
            primary: route.primary,
            prompt,
          });
          lastPromptChars = String(prompt || "").length;
          if (failsafe.active) {
            lastProvider = null;
            lastModel = "local-deterministic";
            lastUpstreamHost = null;
            lastAttempts = ["failsafe"];
            lastInternalFallbackReason = "failsafe_active";
            lastFallbackReason = publicFallbackReason("failsafe_active");
            logSafe(ctx, {
              type: "active_mirror_failsafe_route",
              capability: route.capability,
              reason: cleanProviderCode(failsafe.reason),
            });
            return {
              mirror: null,
              fallback: true,
              routeText: "Active Mirror fail-safe mode is active; no model or tool route was used.",
            };
          }
          const r = await runRoute(route, prompt, env);
          lastProvider = r.provider || null;
          lastModel = r.model || null;
          lastUpstreamHost = r.upstream_host || null;
          lastAttempts = Array.isArray(r.attempts) ? r.attempts : [route.primary];
          lastInternalFallbackReason = r.fallback ? cleanProviderCode(r.fallbackReason || "unknown") : null;
          lastFallbackReason = r.fallback ? publicFallbackReason(r.fallbackReason) : null;
          const routeText = r.fallback
            ? `Backup answer used because ${lastFallbackReason}. Original help type: ${publicRouteLabel(route.capability)}.`
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
          provider_reason: lastInternalFallbackReason || "unknown",
          truth_state: result.truth_state?.status || "unknown",
        });
      }

      const deterministicIdentity = Array.isArray(result.straitjacket) && result.straitjacket.includes("deterministic_identity");
      const deterministicLocal = Array.isArray(result.straitjacket) && result.straitjacket.some((item) =>
        ["deterministic_identity", "deterministic_sycophancy", "deterministic_short_start", "deterministic_short_followup"].includes(item)
      );
      const publicCapability = deterministicIdentity ? "identity" : route.capability;
      const publicLabel = deterministicIdentity ? "identity answer" : deterministicLocal ? "local reflection" : publicRouteLabel(route.capability);
      const publicPrimary = deterministicLocal ? "active_mirror" : route.primary;
      const publicProvider = deterministicLocal
        ? "active_mirror"
        : lastProvider || (lastModel === "local-deterministic" ? "active_mirror" : route.primary);
      const publicModel = deterministicLocal ? "none" : lastModel || "unknown";
      const publicAttempts = deterministicLocal ? ["active_mirror"] : uniqueRouteAttempts(lastAttempts.length ? lastAttempts : [route.primary]);
      const publicRoute = {
        capability: publicCapability,
        label: publicLabel,
        primary: publicPrimary,
        provider: publicProvider,
        model: publicModel,
        upstream_host: publicProvider === "bridge" ? lastUpstreamHost : null,
        fallback: result.fallback ? lastFallbackReason : null,
      };
      const resolution = resolutionContract({ route: publicRoute, selectedRoute: route, result, truth_state: result.truth_state, failsafe });

      return json(
        {
          ok: true,
          fallback: result.fallback,
          receipt_id: result.receipt_id,
          mirror: result.mirror,
          truth_state: result.truth_state,
          straitjacket: result.straitjacket,
          route: publicRoute,
          resolution,
          glass: mirrorDashGlass({
            route: publicRoute,
            selectedRoute: route,
            boundary: input.boundary,
            result,
            attempts: publicAttempts,
            promptHash: lastPromptHash,
            promptChars: lastPromptChars,
            deterministicIdentity,
            failsafe,
            env,
            resolution,
          }),
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
    const failsafe = gatewayFailsafeMode(env);
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
    if (failsafe.active) {
      const research = makeSourceCheckPlan(sourceInput, new Error("failsafe_active"), env);
      const truth_state = {
        status: "needs_checking",
        checked: false,
        label: "Needs sources before you rely on it.",
        reason: "Active Mirror fail-safe mode is active, so no source tool or model route was used.",
        signals: ["failsafe_active", "source_check_incomplete"],
      };
      const receipt_id = await receiptHash({ type: "source_check_failsafe", research, truth_state, question: sourceInput.question });
      const sourceRoute = {
        capability: "source_check",
        label: "source check",
        primary: "active_mirror",
        provider: "active_mirror",
        model: "none",
        upstream_host: null,
        tools: [],
        fallback: publicFallbackReason("failsafe_active"),
      };
      const inputHash = await receiptHash({ type: "active_mirror_source_input", sourceInput, route: sourceRoute });
      const resolution = resolutionContract({ route: sourceRoute, selectedRoute: { capability: "source_check", primary: "active_mirror" }, result: { fallback: true }, truth_state, failsafe, research });
      logSafe(ctx, { type: "active_mirror_failsafe_route", capability: "source_check", reason: cleanProviderCode(failsafe.reason) });
      return json(
        {
          ok: false,
          fallback: true,
          receipt_id,
          truth_state,
          research,
          route: sourceRoute,
          resolution,
          glass: mirrorDashGlass({
            route: sourceRoute,
            selectedRoute: { capability: "source_check", primary: "active_mirror" },
            boundary: sourceInput.boundary,
            result: { fallback: true, truth_state, straitjacket: [] },
            attempts: ["failsafe"],
            promptHash: inputHash,
            promptChars: JSON.stringify(sourceInput).length,
            deterministicIdentity: false,
            failsafe,
            env,
            resolution,
          }),
        },
        503,
        corsHeaders,
      );
    }
    const research = await runSourceCheck(sourceInput, env, ctx);
    const sourceRoute = research.route || sourceCheckRoute("active_mirror", "none", { fallback: "source check route unavailable" });
    const publicResearch = withoutInternalRoute(research);
    const checked = publicResearch.sources.length > 0;
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
    const receipt_id = await receiptHash({ research: publicResearch, sourceRoute, truth_state, intent: sourceInput.intent, question: sourceInput.question });
    const inputHash = await receiptHash({ type: "active_mirror_source_input", sourceInput, route: sourceRoute });
    const resolution = resolutionContract({ route: sourceRoute, selectedRoute: { capability: "source_check", primary: sourceRoute.primary || sourceRoute.provider || "active_mirror" }, result: { fallback: Boolean(publicResearch.fallback) }, truth_state, failsafe, research: publicResearch });

    return json(
      {
        ok: checked,
        fallback: publicResearch.fallback,
        receipt_id,
        truth_state,
        research: publicResearch,
        route: sourceRoute,
        resolution,
        glass: mirrorDashGlass({
          route: sourceRoute,
          selectedRoute: { capability: "source_check", primary: sourceRoute.primary || sourceRoute.provider || "active_mirror" },
          boundary: sourceInput.boundary,
          result: { fallback: Boolean(publicResearch.fallback), truth_state, straitjacket: [] },
          attempts: sourceRoute.attempts || [sourceRoute.provider || "active_mirror"],
          promptHash: inputHash,
          promptChars: JSON.stringify(sourceInput).length,
          deterministicIdentity: false,
          failsafe,
          env,
          resolution,
        }),
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

async function handleArtifact(request, env, ctx, corsHeaders) {
  try {
    const body = await readJsonBody(request, maxMirrorRequestBytes(env));
    const input = sanitizeArtifactInput(body);
    const failsafe = gatewayFailsafeMode(env);
    const budget = await enforceMirrorBudget(request, env, ctx, { capability: "artifact" });
    if (!budget.allowed) {
      return rateLimitedResponse(budget, corsHeaders);
    }

    if (failsafe.active) {
      const artifact = fallbackArtifact(input, "provider");
      const receipt_id = await receiptHash({ type: "artifact_failsafe", artifact, kind: input.kind });
      logSafe(ctx, { type: "active_mirror_failsafe_route", capability: "artifact", reason: cleanProviderCode(failsafe.reason) });
      return json(
        {
          ok: true,
          fallback: true,
          receipt_id,
          artifact,
          truth_state: {
            status: "reflective",
            checked: false,
            label: "Fail-safe artifact created.",
            reason: "Active Mirror fail-safe mode is active, so no artifact model route was used.",
            signals: ["failsafe_active", "deterministic_artifact"],
          },
          route: {
            capability: "artifact",
            label: "artifact help",
            primary: "active_mirror",
            provider: "active_mirror",
            model: "local-deterministic",
            fallback: publicFallbackReason("failsafe_active"),
          },
        },
        200,
        corsHeaders,
      );
    }

    const boundaryText = `${input.intent} ${input.mirror.reflection} ${input.mirror.question} ${input.mirror.move}`;
    if (containsSecret(boundaryText)) {
      const artifact = fallbackArtifact(input, "privacy");
      const receipt_id = await receiptHash({ type: "artifact_privacy_hold", artifact, kind: input.kind });
      return json(
        {
          ok: true,
          fallback: true,
          receipt_id,
          artifact,
          truth_state: {
            status: "reflective",
            checked: false,
            label: "Private details held back.",
            reason: "The artifact request appeared to include a secret or credential, so a safer template was created instead.",
            signals: ["privacy_boundary"],
          },
          route: {
            capability: "artifact",
            label: "artifact help",
            fallback: "private details were held back",
          },
        },
        200,
        corsHeaders,
      );
    }

    if (UNSAFE_ARTIFACT_RE.test(boundaryText)) {
      const artifact = fallbackArtifact(input, "safety");
      const receipt_id = await receiptHash({ type: "artifact_safety_hold", artifact, kind: input.kind });
      return json(
        {
          ok: true,
          fallback: true,
          receipt_id,
          artifact,
          truth_state: {
            status: "reflective",
            checked: false,
            label: "Safer artifact created.",
            reason: "The requested artifact could enable harm or concealment, so Active Mirror created a safer alternative.",
            signals: ["safety_boundary"],
          },
          route: {
            capability: "artifact",
            label: "artifact help",
            fallback: "safer alternative created",
          },
        },
        200,
        corsHeaders,
      );
    }

    const routedInput = input.boundary === "client"
      ? {
          ...input,
          intent: sanitizeModelIntent(input.intent, "client"),
          mirror: {
            reflection: sanitizeModelIntent(input.mirror.reflection, "client"),
            question: sanitizeModelIntent(input.mirror.question, "client"),
            move: sanitizeModelIntent(input.mirror.move, "client"),
          },
        }
      : input;

    const result = await runArtifactRoute(routedInput, env, ctx);
    const artifact = result.artifact || fallbackArtifact(input, "provider");
    const receipt_id = await receiptHash({
      type: "active_mirror_artifact",
      kind: artifact.kind,
      title: artifact.title,
      body: artifact.body,
      fallback: Boolean(result.fallback),
    });

    if (result.fallback) {
      logSafe(ctx, {
        type: "active_mirror_artifact_fallback",
        kind: artifact.kind,
        reason: result.publicReason || "the artifact route used a backup",
      });
    }

    return json(
      {
        ok: true,
        fallback: Boolean(result.fallback),
        receipt_id,
        artifact,
        truth_state: {
          status: "reflective",
          checked: false,
          label: "Artifact created.",
          reason: "The artifact was created from this turn and the current reflection. Current factual claims still need source checking before reliance.",
          signals: ["artifact_created"],
        },
        route: {
          capability: "artifact",
          label: "artifact help",
          fallback: result.fallback ? result.publicReason || "the artifact route used a backup" : null,
        },
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    if (error?.status) {
      return json({ ok: false, error: error.code || "bad_request" }, error.status, corsHeaders);
    }
    logSafe(ctx, { type: "active_mirror_gateway_error", surface: "artifact", reason: safeError(error) });
    return json({ ok: false, error: "artifact_gateway_error" }, 500, corsHeaders);
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

function gatewayFailsafeMode(env) {
  const active =
    envFlag(env.ACTIVE_MIRROR_FAILSAFE) ||
    envFlag(env.MIRROR_GATEWAY_FAILSAFE) ||
    envFlag(env.MIRROR_MODEL_EGRESS_DISABLED);
  return {
    active,
    reason: active ? cleanProviderCode(env.ACTIVE_MIRROR_FAILSAFE_REASON || "operator_or_policy_failsafe") : null,
  };
}

function envFlag(value) {
  return /^(1|true|yes|on|enabled)$/i.test(String(value || "").trim());
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
  if (!hasUsableMirrorIntent(intent)) throw httpError(400, "intent_too_short");
  const boundary = String(body?.boundary || "personal").toLowerCase();
  return {
    intent,
    boundary: BOUNDARIES[boundary] ? boundary : "personal",
    route: normalizeRoute(body?.route),
    turn: Number.isFinite(body?.turn) ? Math.max(1, Math.min(9999, Math.trunc(body.turn))) : 1,
    mode: normalizeMirrorMode(body?.mode),
  };
}

function hasUsableMirrorIntent(intent = "") {
  const normalized = String(intent || "").trim();
  if (!normalized) return false;
  const lettersAndNumbers = normalized.replace(/[^a-z0-9]/gi, "");
  if (lettersAndNumbers.length < 4) return false;
  return /[a-z]/i.test(lettersAndNumbers);
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

function sanitizeArtifactInput(body) {
  const intent = cleanSourceText(body?.intent, 1000);
  const boundary = String(body?.boundary || "personal").toLowerCase();
  const kind = normalizeArtifactKind(body?.artifactKind || body?.kind);
  const mirror = {
    reflection: cleanSourceText(body?.mirror?.reflection, 420),
    question: cleanSourceText(body?.mirror?.question, 240),
    move: cleanSourceText(body?.mirror?.move, 240),
  };
  const target = intent || mirror.question || mirror.move || mirror.reflection;
  if (target.length < 8) throw httpError(400, "artifact_intent_required");
  return {
    intent: intent || target,
    boundary: BOUNDARIES[boundary] ? boundary : "personal",
    kind,
    mirror,
  };
}

function normalizeArtifactKind(value) {
  const kind = String(value || "draft").toLowerCase().replace(/[^a-z]/g, "");
  return ARTIFACT_KINDS.has(kind) ? kind : "draft";
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

function normalizeMirrorMode(value) {
  const mode = String(value || "standard").toLowerCase().replace(/[^a-z_]/g, "");
  return ["standard", "short_start_followup"].includes(mode) ? mode : "standard";
}

// --- Routing: a runtime concern. Picks which provider/model answers a turn. ---
function selectRoute(intent, selected = "auto", env = {}) {
  if (selected === "media") return mediaRoute(env);
  if (selected === "chat") return chatRoute(env);
  if (selected === "reflection") return reflectionRoute(env);

  const value = intent.toLowerCase();
  if (/\b(image|visual|video|poster|screenshot|render|asset|thumbnail|media)\b/.test(value)) {
    return mediaRoute(env);
  }
  if (/\b(chat|rewrite|tone|copy|critique|review|polish)\b/.test(value)) {
    return chatRoute(env);
  }
  return reflectionRoute(env);
}

function reflectionRoute(env = {}) {
  const primary = allowedPrimary(env.MIRROR_REFLECTION_PRIMARY, "bridge");
  return modelRoute("reflection", primary);
}

function chatRoute(env = {}) {
  const primary = allowedPrimary(env.MIRROR_CHAT_PRIMARY || env.MIRROR_REFLECTION_PRIMARY, "bridge");
  return modelRoute("chat", primary);
}

function mediaRoute(env = {}) {
  const primary = allowedPrimary(env.MIRROR_MEDIA_PRIMARY, "gemini");
  return modelRoute("media", primary);
}

function allowedPrimary(value, fallback) {
  const primary = String(value || "").trim().toLowerCase();
  return ["bridge", "anthropic", "openai", "gemini"].includes(primary) ? primary : fallback;
}

function modelRoute(capability, primary) {
  const routes = {
    bridge: { modelEnv: "MINI_REFLECTION_MODEL", defaultModel: "mini-mirror-bridge" },
    anthropic: { modelEnv: "ANTHROPIC_REFLECTION_MODEL", defaultModel: "claude-sonnet-4-5" },
    openai: { modelEnv: "OPENAI_REFLECTION_MODEL", defaultModel: "gpt-5.5" },
    gemini: { modelEnv: "GEMINI_MEDIA_MODEL", defaultModel: "gemini-3.5-flash" },
  };
  return { capability, primary, ...routes[primary] };
}

// --- Provider calls. The kernel never sees any of this. Returns { fallback, fallbackReason, model, mirror }. ---
async function runRoute(route, prompt, env, attempted = []) {
  const provider = route.primary;
  const nextAttempted = [...attempted, provider];

  try {
    if (provider === "bridge" && env.MIRROR_BRIDGE_URL && env.MIRROR_BRIDGE_TOKEN) {
      return withRouteAttempts(await callBridge(prompt, route, env), nextAttempted);
    }
    if (provider === "openai" && env.OPENAI_API_KEY) {
      return withRouteAttempts(await callOpenAI(prompt, route, env), nextAttempted);
    }
    if (provider === "anthropic" && env.ANTHROPIC_API_KEY) {
      return withRouteAttempts(await callAnthropic(prompt, route, env), nextAttempted);
    }
    if (provider === "gemini" && (env.GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER || env.GEMINI_API_KEY)) {
      return withRouteAttempts(await callGemini(prompt, route, env), nextAttempted);
    }
  } catch (error) {
    return fallbackResult(route, prompt, env, nextAttempted, providerFailureReason(provider, error));
  }

  const fallbackRoute = chooseFallbackRoute(route, env, nextAttempted);
  if (fallbackRoute) {
    return fallbackResult(route, prompt, env, nextAttempted, `${provider}_missing_secret`);
  }

  return { fallback: true, fallbackReason: "no_provider_secret_configured", model: "local-deterministic", mirror: null, provider: null, attempts: uniqueRouteAttempts(nextAttempted) };
}

async function fallbackResult(route, prompt, env, attempted, reason) {
  const fallbackRoute = chooseFallbackRoute(route, env, attempted);
  if (!fallbackRoute) {
    return { fallback: true, fallbackReason: reason, model: "local-deterministic", mirror: null, provider: null, attempts: uniqueRouteAttempts(attempted) };
  }
  try {
    const result = await runRoute(fallbackRoute, prompt, env, attempted);
    return { ...result, fallback: true, fallbackReason: reason, attempts: uniqueRouteAttempts(result.attempts || [...attempted, fallbackRoute.primary]) };
  } catch {
    return { fallback: true, fallbackReason: reason, model: "local-deterministic", mirror: null, provider: null, attempts: uniqueRouteAttempts([...attempted, fallbackRoute.primary]) };
  }
}

function withRouteAttempts(result, attempts) {
  return { ...result, attempts: uniqueRouteAttempts(attempts) };
}

function uniqueRouteAttempts(attempts = []) {
  return [...new Set(attempts.map((item) => cleanProviderCode(item).toLowerCase()).filter(Boolean))];
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

async function runArtifactRoute(input, env, ctx) {
  const prompt = buildArtifactPrompt(input);
  const providers = artifactProviderOrder(input.kind, env);
  let lastReason = "no_provider_secret_configured";

  for (const provider of providers) {
    try {
      if (provider === "openai") {
        return await callOpenAIArtifact(prompt, input, env);
      }
      if (provider === "anthropic") {
        return await callAnthropicArtifact(prompt, input, env);
      }
      if (provider === "gemini") {
        return await callGeminiArtifact(prompt, input, env);
      }
    } catch (error) {
      lastReason = providerFailureReason(provider, error);
      logSafe(ctx, {
        type: "active_mirror_artifact_provider_failed",
        provider,
        kind: input.kind,
        reason: cleanProviderCode(lastReason),
      });
    }
  }

  return {
    fallback: true,
    publicReason: publicFallbackReason(lastReason),
    artifact: fallbackArtifact(input, "provider"),
  };
}

function artifactProviderOrder(kind, env) {
  const hasOpenAI = Boolean(env.OPENAI_API_KEY);
  const hasAnthropic = Boolean(env.ANTHROPIC_API_KEY);
  const hasGemini = Boolean(env.GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER || env.GEMINI_API_KEY);
  const preferred = normalizeArtifactProvider(env.MIRROR_ARTIFACT_PRIMARY || "");
  const defaults = kind === "image" ? ["gemini", "openai", "anthropic"] : ["openai", "anthropic", "gemini"];
  const ordered = [preferred, ...defaults].filter(Boolean);
  return [...new Set(ordered)].filter((provider) => {
    if (provider === "openai") return hasOpenAI;
    if (provider === "anthropic") return hasAnthropic;
    if (provider === "gemini") return hasGemini;
    return false;
  });
}

function normalizeArtifactProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  return ["openai", "anthropic", "gemini"].includes(provider) ? provider : "";
}

function buildArtifactPrompt(input) {
  const kindGuidance = {
    doc: "Create a useful document the user can copy or download now. Include the finished document body, a one-sentence purpose, a short draft, and a concrete ask or next step. Do not explain how to make the document; make it.",
    code: "Create a small code starter or implementation capsule. If the stack is unclear, use the smallest useful vanilla JavaScript example plus assumptions. Include code, acceptance checks, and how to run or adapt it. Do not ask for more context unless code would be unsafe.",
    image: "Create a visual generation brief. It must be directly usable as an image/video prompt and include scene, composition, feeling, constraints, and what to avoid.",
    draft: "Create the smallest sendable draft or working note. It should be useful even if rough, with placeholders where needed.",
  }[input.kind];

  return [
    "You are Active Mirror's artifact maker.",
    "Trust by Design means: if the product offers an artifact, provide the smallest useful safe artifact now.",
    "Do not refuse because context is imperfect. Use placeholders and state assumptions inside the artifact when needed.",
    "Do not mention policies, models, providers, gateways, receipts, or internal tokens.",
    "Do not start with meta-help such as 'I can help', 'you could', 'here is how', or 'consider'. Start with the artifact itself.",
    "Do not flatter, diagnose, scold, or write therapy language.",
    "Do not invent current facts, citations, prices, legal/medical/financial advice, or private details.",
    "If a claim needs sources, make the artifact say where evidence is needed instead of making the claim sound proven.",
    "Use normal words. Keep it clean, human, and immediately usable.",
    "Return valid JSON only with kind, title, body, checklist.",
    "Plain ASCII only. No prose outside JSON.",
    `Artifact kind: ${input.kind}`,
    kindGuidance,
    "",
    `User asked: ${input.intent}`,
    `Reflection: ${input.mirror.reflection || "not provided"}`,
    `Question: ${input.mirror.question || "not provided"}`,
    `Move: ${input.mirror.move || "not provided"}`,
  ].join("\n");
}

async function callOpenAIArtifact(prompt, input, env) {
  const model = env.OPENAI_ARTIFACT_MODEL || env.OPENAI_FAST_MODEL || env.OPENAI_REFLECTION_MODEL || "gpt-5.4-mini";
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
        text: { format: { type: "json_schema", name: "active_mirror_artifact", strict: true, schema: ARTIFACT_SCHEMA } },
        max_output_tokens: 1600,
      }),
    },
    "openai",
    env,
  );
  const data = await readProviderResponse(response, "openai");
  return normalizeArtifactResult(extractOpenAIText(data), input);
}

async function callAnthropicArtifact(prompt, input, env) {
  const model = env.ANTHROPIC_ARTIFACT_MODEL || env.ANTHROPIC_REFLECTION_MODEL || "claude-3-5-sonnet-20241022";
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
        max_tokens: 1600,
        temperature: 0.35,
        system: "Return one useful Active Mirror artifact as valid JSON only. No markdown outside JSON.",
        messages: [{ role: "user", content: prompt }],
      }),
    },
    "anthropic",
    env,
  );
  const data = await readProviderResponse(response, "anthropic");
  return normalizeArtifactResult(extractAnthropicText(data), input);
}

async function callGeminiArtifact(prompt, input, env) {
  const model = input.kind === "image"
    ? env.GEMINI_ARTIFACT_MODEL || env.GEMINI_MEDIA_MODEL || "gemini-2.5-flash"
    : env.GEMINI_ARTIFACT_MODEL || env.GEMINI_SOURCE_MODEL || env.GEMINI_MEDIA_MODEL || "gemini-2.5-flash";
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
        systemInstruction: { parts: [{ text: "Return one useful Active Mirror artifact as valid JSON only." }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseJsonSchema: ARTIFACT_SCHEMA },
      }),
    },
    "gemini",
    env,
  );
  const data = await readProviderResponse(response, "gemini");
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  return normalizeArtifactResult(text, input);
}

function normalizeArtifactResult(text, input) {
  const payload = parseArtifactPayload(text);
  const kind = normalizeArtifactKind(payload?.kind || input.kind);
  const title = cleanArtifactText(payload?.title, defaultArtifactTitle(kind), 80).replace(/[.]+$/, "");
  const body = cleanArtifactBody(payload?.body, "").trim();
  const checklist = Array.isArray(payload?.checklist)
    ? payload.checklist.map((item) => cleanArtifactText(item, "", 140)).filter(Boolean).slice(0, 4)
    : [];

  if (!body || body.length < 20 || artifactNeedsFallback(body)) {
    return {
      fallback: true,
      publicReason: "the live artifact needed a cleaner backup",
      artifact: fallbackArtifact({ ...input, kind }, "thin"),
    };
  }

  return {
    fallback: false,
    artifact: {
      kind,
      title: title || defaultArtifactTitle(kind),
      body,
      checklist: checklist.length ? checklist : defaultArtifactChecklist(kind),
    },
  };
}

function artifactNeedsFallback(body) {
  const text = String(body || "");
  return WEAK_ARTIFACT_RE.test(text) || ARTIFACT_INTERNAL_RE.test(text);
}

function parseArtifactPayload(text) {
  const value = String(text || "").trim();
  if (!value) return {};
  const jsonText = value.startsWith("```") ? value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim() : value;
  try {
    return JSON.parse(jsonText);
  } catch {
    return { body: value };
  }
}

function cleanArtifactText(value, fallback, maxLength) {
  const clean = String(value || "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (clean || fallback).slice(0, maxLength);
}

function cleanArtifactBody(value, fallback) {
  const clean = String(value || "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  return (clean || fallback).slice(0, 6000);
}

function defaultArtifactTitle(kind) {
  return {
    doc: "Working doc",
    code: "Code starter",
    image: "Visual brief",
    draft: "Message draft",
  }[kind] || "Working draft";
}

function defaultArtifactChecklist(kind) {
  if (kind === "code") return ["Test the smallest path first.", "Keep private inputs out of logs."];
  if (kind === "image") return ["Remove private details before media generation.", "Use the brief as the creative prompt."];
  return ["Remove private details before sharing.", "Keep the first version small enough to use."];
}

function fallbackArtifact(input, reason = "provider") {
  const kind = normalizeArtifactKind(input.kind);
  const intent = cleanArtifactText(input.intent, "the thing you want", 180);
  const question = cleanArtifactText(input.mirror?.question, "What output would help right now?", 180);
  const move = cleanArtifactText(input.mirror?.move, "Create the smallest useful version.", 180);

  if (reason === "privacy") {
    return {
      kind: "draft",
      title: "Safe version",
      body: [
        "Use this version without private details:",
        "",
        "I need help with [problem] for [goal].",
        "The private details are replaced with placeholders.",
        "The useful output I want is [document, message, code, visual, or decision].",
      ].join("\n"),
      checklist: ["Replace names, keys, and account details with placeholders.", "Send the safer version instead."],
    };
  }

  if (reason === "safety") {
    return {
      kind: "doc",
      title: "Safer path",
      body: [
        "That request crosses a safety line.",
        "",
        `Useful substitute: ${intent}`,
        "",
        "Safer output",
        "- Name the legitimate goal.",
        "- Remove the harmful or deceptive step.",
        "- Ask for a defensive, lawful, or repair-focused version.",
        "",
        `Next move: ${move}`,
      ].join("\n"),
      checklist: ["Keep the goal lawful and defensive.", "Do not include credentials, targets, or evasion steps."],
    };
  }

  if (kind === "code") {
    return {
      kind,
      title: "Code starter",
      body: [
        "Goal",
        intent,
        "",
        "Assumption",
        "Use this as a tiny browser-safe starter until the exact stack is known.",
        "",
        "Acceptance",
        `- ${move}`,
        "- Keep the first version small enough to test in one screen.",
        "- Do not add external calls, storage, or destructive actions unless approved.",
        "",
        "Starter",
        "```js",
        "export function nextStep(input) {",
        "  const text = String(input || \"\").trim();",
        "  if (!text) return { ok: false, message: \"Add one sentence first.\" };",
        "  return { ok: true, move: text };",
        "}",
        "```",
      ].join("\n"),
      checklist: ["Replace the starter with the target stack once known.", "Keep private inputs out of logs."],
    };
  }

  if (kind === "image") {
    return {
      kind,
      title: "Visual brief",
      body: [
        "Prompt",
        "",
        `Create one polished visual for: ${intent}`,
        "",
        "Scene",
        "A clear human moment where the result is visible immediately. One focal point, warm light, clean composition, subtle glow, no clutter.",
        "",
        "Feeling",
        "Feeling: warm, simple, useful, lightly magical, not busy.",
        "",
        "Message",
        question,
        "",
        "Avoid",
        "Avoid: clutter, medical cues, diagnostics, dashboard overload, model names, private details.",
        "",
        `Next action: ${move}`,
      ].join("\n"),
      checklist: ["Remove private details before generation.", "Use this as the image or video prompt."],
    };
  }

  if (kind === "doc") {
    return {
      kind,
      title: "Working doc",
      body: [
        "Title",
        intent,
        "",
        "Purpose",
        `Turn this into one usable output: ${question}`,
        "",
        "Draft",
        `The clearest version is: ${move}`,
        "",
        "Ask",
        "Please react to the promise, the next step, and anything that feels unclear.",
        "",
        "Next move",
        move,
        "",
        "Sendable version",
        `I am working on this: ${intent}`,
        `The next thing I am trying is: ${move}`,
        "What would make this stronger or easier to act on?",
      ].join("\n"),
      checklist: ["Remove private details before sharing.", "Keep the ask to one sentence if you send it."],
    };
  }

  return {
    kind: "draft",
    title: "Message draft",
    body: [
      `I am working on ${intent}.`,
      "",
      `The useful question is: ${question}`,
      "",
      `My next step is: ${move}`,
      "",
      "Can you give me one honest reaction and one improvement?",
    ].join("\n"),
    checklist: ["Remove private details before sharing.", "Keep it short enough to send."],
  };
}

async function callBridge(prompt, route, env) {
  const bridgeUrl = String(env.MIRROR_BRIDGE_URL).replace(/\/+$/, "");
  const response = await fetchWithTimeout(
    `${bridgeUrl}/v1/mirror/reflect`,
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
  return { fallback: false, model: data.model || "mini-mirror-bridge", mirror: data.mirror, provider: "bridge", upstream_host: safeUrlHost(bridgeUrl) };
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
  return { fallback: false, model, mirror: parseProviderMirror(extractAnthropicText(data), "anthropic"), provider: "anthropic" };
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
        text: { format: { type: "json_schema", name: "active_mirror_turn", strict: true, schema: PROVIDER_MIRROR_SCHEMA } },
        max_output_tokens: 1000,
      }),
    },
    "openai",
    env,
  );

  const data = await readProviderResponse(response, "openai");
  return { fallback: false, model, mirror: parseProviderMirror(extractOpenAIText(data), "openai"), provider: "openai" };
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
  return { fallback: false, model, mirror: parseProviderMirror(text, "gemini"), provider: "gemini" };
}

async function runSourceCheck(input, env, ctx) {
  if (!env.OPENAI_API_KEY) {
    if (env.GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER || env.GEMINI_API_KEY) {
      return callGeminiSourceCheck(input, env, ctx);
    }
    return {
      fallback: true,
      verdict: "not_enough",
      answer: "Source checking is not available right now.",
      changes: "Do not rely on this claim until a source-backed check is run.",
      source_quality: {
        best_score: 0,
        high_quality_count: 0,
        weak_count: 0,
        count: 0,
        domain_allowlist: sourceDomainAllowlist(env).length ? "active" : "not_configured",
        domain_allowlist_count: sourceDomainAllowlist(env).length,
      },
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
        return makeSourceCheckPlan(input, fallbackError, env);
      }
    }
    return makeSourceCheckPlan(input, error, env);
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
  const toolTypes = sourceToolCandidates("openai", [configuredTool, "web_search", "web_search_preview"]);
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
            tools: [openAISourceTool(toolType, env)],
            tool_choice: toolType === "web_search" ? "required" : "auto",
            text: { format: { type: "json_schema", name: "active_mirror_source_check", strict: true, schema: SOURCE_CHECK_SCHEMA } },
            ...(toolType === "web_search" ? { include: ["web_search_call.action.sources"] } : {}),
            max_output_tokens: 1200,
          }),
        },
        "openai",
        env,
      );
      const data = await readProviderResponse(response, "openai");
      const payload = parseSourceCheckPayload(extractOpenAIText(data));
      return {
        ...normalizeSourceCheck(payload, extractSourceAnnotations(data), env),
        route: sourceCheckRoute("openai", model, { tools: [toolType], attempts: ["openai"] }),
      };
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
  const toolCandidates = sourceToolCandidates("gemini", ["google_search", "google_search_retrieval"]).map(geminiSourceTool);
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
        const tool = Object.keys(tools?.[0] || {})[0] || "google_search";
        return {
          ...normalizeSourceCheck(payload, extractGeminiSourceAnnotations(data), env),
          fallback: true,
          route: sourceCheckRoute("gemini", model, { tools: [tool], attempts: ["gemini"], fallback: "primary source route unavailable" }),
        };
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

function sourceCheckRoute(provider, model, options = {}) {
  const routeProvider = cleanProviderCode(provider || "active_mirror").toLowerCase() || "active_mirror";
  return {
    capability: "source_check",
    label: "source check",
    primary: options.primary || routeProvider,
    provider: routeProvider,
    model: cleanProviderCode(model || "none") || "none",
    upstream_host: null,
    tools: options.tools || [],
    attempts: options.attempts || [routeProvider],
    fallback: options.fallback || null,
  };
}

function withoutInternalRoute(research) {
  if (!research || typeof research !== "object") return research;
  const { route: _route, ...publicResearch } = research;
  return publicResearch;
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

function sourceToolCandidates(provider, requested = []) {
  const allowed = new Set(SOURCE_TOOL_ALLOWLIST[provider] || []);
  return [...new Set(requested.map((tool) => cleanProviderCode(tool).toLowerCase()).filter(Boolean))].filter((tool) => allowed.has(tool));
}

function openAISourceTool(toolType, env) {
  const tool = { type: toolType, search_context_size: "medium" };
  const domains = sourceDomainAllowlist(env);
  if (toolType === "web_search" && domains.length) {
    tool.filters = { allowed_domains: domains };
  }
  if (toolType === "web_search") {
    tool.external_web_access = !envFlag(env.ACTIVE_MIRROR_SOURCE_CACHE_ONLY);
  }
  return tool;
}

function geminiSourceTool(toolType) {
  return [{ [toolType]: {} }];
}

function sourceDomainAllowlist(env = {}) {
  return String(env.ACTIVE_MIRROR_SOURCE_DOMAIN_ALLOWLIST || env.SOURCE_DOMAIN_ALLOWLIST || "")
    .split(",")
    .map(normalizeAllowedDomain)
    .filter(Boolean)
    .slice(0, 50);
}

function normalizeAllowedDomain(value) {
  let domain = String(value || "").trim().toLowerCase();
  if (!domain) return "";
  if (/^https?:\/\//.test(domain)) {
    try {
      domain = new URL(domain).hostname;
    } catch {
      return "";
    }
  }
  domain = domain.replace(/^\*\./, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return "";
  return domain;
}

function sourceAllowedByDomain(source, allowlist) {
  if (!allowlist.length) return true;
  let host = "";
  try {
    host = new URL(source?.url || "").hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
  return allowlist.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function publicSourcePolicy(env = {}) {
  const domains = sourceDomainAllowlist(env);
  return {
    current_or_external_claims: "source_check_or_needs_checking",
    model_training_memory_is_authority: false,
    internet_access: envFlag(env.ACTIVE_MIRROR_SOURCE_CACHE_ONLY) ? "source_tool_cache_only_with_receipts" : "source_tool_live_with_receipts",
    source_tool_allowlist: "enabled",
    allowed_tools: {
      openai: SOURCE_TOOL_ALLOWLIST.openai,
      gemini: SOURCE_TOOL_ALLOWLIST.gemini,
    },
    domain_allowlist: domains.length ? "active" : "not_configured",
    domain_allowlist_count: domains.length,
    if_tool_unavailable: "mark_needs_checking",
  };
}

function resolutionContract({ route, selectedRoute, result, truth_state, failsafe, research }) {
  const capability = selectedRoute?.capability || route?.capability || "reflection";
  const fallback = Boolean(result?.fallback || route?.fallback);
  const needsSources = truth_state?.status === "needs_checking";
  const failSafeActive = Boolean(failsafe?.active);
  const sourceGap = capability === "source_check" && (!Array.isArray(research?.sources) || research.sources.length === 0);
  const domainAllowlistActive = research?.source_quality?.domain_allowlist === "active";

  let status = "clear";
  let title = "No repair required";
  let fix_path = "Continue through Mirror Loop v1.";
  let owner = "active_mirror_runtime";
  let command = null;
  let proof_needed = "receipt_id present, Glass present, truth_state scoped";
  let auto_fixable = false;
  const search_policy = {
    mode: "obsess_until_evidence_or_impossibility",
    deepen_order: ["official_docs", "source_check", "repository_search", "papers", "standards", "human_approval"],
    stop_condition: "supported_sources_or_named_blocker",
  };

  if (failSafeActive) {
    status = "hard_stop";
    title = "Fail-safe is active";
    fix_path = "Remove the fail-safe flag only after the operator confirms model/tool egress should resume.";
    owner = "operator";
    command = "Unset ACTIVE_MIRROR_FAILSAFE, MIRROR_GATEWAY_FAILSAFE, or MIRROR_MODEL_EGRESS_DISABLED, then rerun worker canaries.";
    proof_needed = "health guardrails show failsafe=armed and model_egress=enabled";
  } else if (sourceGap) {
    status = "search_deeper";
    title = domainAllowlistActive ? "No allowed-domain citation found" : "No citation survived source check";
    fix_path = domainAllowlistActive
      ? "Expand or correct the source domain allowlist, or run a narrower query against approved domains."
      : "Run a narrower source-check query and prefer official docs, papers, standards, or primary repositories.";
    owner = "source_checker";
    command = "POST /v1/mirror/source-check with a narrower question and source-first move.";
    proof_needed = "truth_state.status=checked and research.sources.length>0";
    auto_fixable = true;
  } else if (needsSources) {
    status = "needs_source_check";
    title = "Claim needs source proof";
    fix_path = "Route the exact claim through source-check before relying on it.";
    owner = "active_mirror_runtime";
    command = "POST /v1/mirror/source-check";
    proof_needed = "source-check receipt with checked truth_state or explicit not_enough verdict";
    auto_fixable = true;
  } else if (fallback) {
    status = "repair_route";
    title = "Primary route did not answer";
    fix_path = "Inspect configured provider secrets, bridge health, and fallback attempts; keep current answer usable but not silently promoted.";
    owner = "gateway_operator";
    command = "GET /health, then run npm run monitor:gateway and npm run canary:prod after deploy.";
    proof_needed = "route.fallback=null on the intended primary route, or fallback explicitly accepted";
  }

  return {
    policy: RESOLUTION_POLICY.id,
    rule: RESOLUTION_POLICY.rule,
    status,
    title,
    fix_path,
    owner,
    command,
    proof_needed,
    auto_fixable,
    search_policy,
  };
}

function normalizeSourceCheck(payload, annotations = [], env = {}) {
  const payloadSources = Array.isArray(payload?.sources) ? payload.sources : [];
  const domainAllowlist = sourceDomainAllowlist(env);
  const rankedSources = rankSourcesByQuality(uniqueSources([...payloadSources, ...annotations]));
  const sources = rankedSources.filter((source) => sourceAllowedByDomain(source, domainAllowlist)).slice(0, 5);
  const answer = cleanResearchText(payload?.answer, "The evidence needs a narrower check before relying on the claim.", 520);
  const changes = cleanResearchText(
    domainAllowlist.length && !sources.length
      ? "The source route returned no sources inside the configured source domain allowlist."
      : payload?.changes,
    "Use this as a check on the next move, not as a final answer.",
    260,
  );
  const verdict = normalizeSourceVerdict(payload?.verdict, answer, sources);
  const source_quality = summarizeSourceQuality(sources);
  source_quality.domain_allowlist = domainAllowlist.length ? "active" : "not_configured";
  source_quality.domain_allowlist_count = domainAllowlist.length;
  return {
    fallback: false,
    verdict,
    answer,
    changes,
    source_quality,
    sources,
  };
}

function makeSourceCheckPlan(input, error, env = {}) {
  const narrow = cleanResearchText(input.question || input.intent, "the claim", 160);
  const query = `"${narrow.replace(/"/g, "")}"`;
  const domains = sourceDomainAllowlist(env);
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
      domain_allowlist: domains.length ? "active" : "not_configured",
      domain_allowlist_count: domains.length,
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
  const code = cleanProviderCode(reason || "").toLowerCase();
  if (code.includes("failsafe")) {
    return "fail-safe mode is active";
  }
  if (!code || code.includes("missing_secret") || code.includes("no_provider_secret")) {
    return "the live answer is not fully configured";
  }
  if (code.includes("timeout")) {
    return "the live answer timed out";
  }
  if (code.includes("429")) {
    return "the live answer is cooling down";
  }
  if (/(^|_)5\d\d($|_)/.test(code) || code.includes("provider_error")) {
    return "the live answer is unavailable right now";
  }
  return "the live answer is unavailable right now";
}

function mirrorDashGlass({ route, selectedRoute, boundary, result, attempts, promptHash, promptChars, deterministicIdentity, failsafe, env, resolution }) {
  const answeredByModel = route.provider && !["active_mirror", "none"].includes(route.provider);
  const tools = [];
  if (selectedRoute.capability === "source_check") tools.push("source_web_search");
  if (selectedRoute.capability === "media") tools.push("media_generation");

  return {
    surface: "MirrorDash Glass",
    contract: "transparent_router",
    identity: {
      visible: "Active Mirror",
      user_role: "the user's mirror",
      worker_role: "model worker",
      rule: "The mirror is the filter; the model never becomes the identity.",
      capsule: publicIdentityCapsule(),
    },
    algorithm: ACTIVE_MIRROR_ALGORITHM,
    recursion_lock: RECURSIVE_PERFECTION_LOCK,
    council_control_plane: COUNCIL_CONTROL_PLANE,
    router: {
      selected_capability: selectedRoute.capability,
      selected_primary: selectedRoute.primary,
      answered_provider: route.provider,
      answered_model: route.model,
      attempts,
      fallback: Boolean(result.fallback),
      fallback_reason: route.fallback,
      upstream_host: route.upstream_host,
      deterministic: Boolean(deterministicIdentity || route.provider === "active_mirror"),
      failsafe: Boolean(failsafe?.active),
      failsafe_reason: failsafe?.active ? failsafe.reason : null,
    },
    prompt: {
      boot_id: ACTIVE_MIRROR_BOOT_VERSION,
      prompt_hash: promptHash,
      prompt_chars: promptChars,
      body_disclosed: false,
      disclosure: "hash_only",
      sent_to: answeredByModel ? route.provider : "none",
    },
    tools: {
      used: failsafe?.active ? [] : tools,
      disclosure: failsafe?.active ? "none" : tools.length ? "names_only" : "none",
    },
    source_policy: publicSourcePolicy(env),
    resolution,
    promotion_policy: PROMOTION_POLICY,
    memory: {
      mode: "scoped",
      used: ["current_turn", `boundary_${boundary}`],
      excluded: ["raw_vault", "model_memory", "unapproved_memory"],
      write_policy: "model_cannot_write_memory",
    },
    egress: {
      model_route_allowed: !failsafe?.active && answeredByModel,
      tool_route_allowed: !failsafe?.active,
      raw_vault_route_allowed: false,
      prompt_body_telemetry_allowed: false,
    },
    gates: {
      straitjacket: result.straitjacket || [],
      truth_state: result.truth_state?.status || "unknown",
      mirror_filter: "enabled",
      model_identity_filter: "enabled",
      failsafe: failsafe?.active ? "active" : "armed",
    },
    opaque: [
      "provider_weights",
      "provider_hidden_reasoning",
      "provider_infrastructure",
    ],
  };
}

function publicRoutes(env) {
  const failsafe = gatewayFailsafeMode(env);
  const sourceRouteStatus = hasSourceCheckRoute(env) ? "available" : "unavailable";
  const modelRouteStatus = (available) => failsafe.active ? "fail-safe" : available;
  return {
    reflection: {
      label: "reflection help",
      status: modelRouteStatus((env.MIRROR_BRIDGE_URL && env.MIRROR_BRIDGE_TOKEN) || env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY ? "available" : "browser fallback"),
      purpose: "reflective reasoning and first-use mirror generation",
    },
    chat: {
      label: "critique help",
      status: modelRouteStatus((env.MIRROR_BRIDGE_URL && env.MIRROR_BRIDGE_TOKEN) || env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY ? "available" : "browser fallback"),
      purpose: "chat polish, critique, rewrite, and receipt review",
    },
    media: {
      label: "media help",
      status: modelRouteStatus(env.GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER || env.GEMINI_API_KEY ? "available" : "browser fallback"),
      purpose: "images, video, multimodal understanding, and media assets",
    },
    artifact: {
      label: "artifact help",
      status: modelRouteStatus(hasArtifactRoute(env) ? "available" : "browser fallback"),
      purpose: "documents, code starters, drafts, and visual briefs created from a reflection",
    },
    source_check: {
      label: "source check",
      status: failsafe.active ? "fail-safe" : sourceRouteStatus,
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
  const failsafe = gatewayFailsafeMode(env);
  const sourcePolicy = publicSourcePolicy(env);
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
    mirrordash_glass: "enabled",
    router_transparency: "enabled",
    prompt_disclosure: "hash_only",
    current_facts_require_source_check: "enabled",
    active_mirror_algorithm: ACTIVE_MIRROR_ALGORITHM.id,
    active_mirror_ethos: ACTIVE_MIRROR_ALGORITHM.ethos,
    active_mirror_algorithm_invariant: ACTIVE_MIRROR_ALGORITHM.invariant,
    active_mirror_ratchet: ACTIVE_MIRROR_ALGORITHM.ratchet,
    recursive_perfection_lock: RECURSIVE_PERFECTION_LOCK.id,
    recursive_perfection_definition: RECURSIVE_PERFECTION_LOCK.definition,
    resolution_contract: RESOLUTION_POLICY.id,
    resolution_rule: RESOLUTION_POLICY.rule,
    reflection_promotion: PROMOTION_POLICY.id,
    training_amendability: PROMOTION_POLICY.training,
    reverse_abliteration: PROMOTION_POLICY.reverse_abliteration,
    council_control_plane: COUNCIL_CONTROL_PLANE.id,
    council_route: COUNCIL_CONTROL_PLANE.route,
    council_count: String(COUNCIL_CONTROL_PLANE.councils.length),
    source_live_web_access: sourcePolicy.internet_access,
    source_tool_allowlist: sourcePolicy.source_tool_allowlist,
    source_tool_allowlist_openai: SOURCE_TOOL_ALLOWLIST.openai.join(","),
    source_tool_allowlist_gemini: SOURCE_TOOL_ALLOWLIST.gemini.join(","),
    source_domain_allowlist: sourcePolicy.domain_allowlist,
    source_domain_allowlist_count: String(sourcePolicy.domain_allowlist_count),
    failsafe: failsafe.active ? "active" : "armed",
    model_egress: failsafe.active ? "disabled" : "enabled",
    source_check: hasSourceCheckRoute(env) ? "enabled" : "not_configured",
    artifact: "enabled",
  };
}

function publicIdentityCapsule() {
  return {
    version: ACTIVE_MIRROR_IDENTITY_CAPSULE_VERSION,
    source_hash: ACTIVE_MIRROR_IDENTITY_SOURCE_HASH,
    source_count: ACTIVE_MIRROR_IDENTITY_SOURCES.length,
    source_contract: "identity/active-mirror-identity.json",
    public_instructions: "https://activemirror.ai/llms.txt",
  };
}

function hasSourceCheckRoute(env) {
  return Boolean(env.OPENAI_API_KEY || env.GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER || env.GEMINI_API_KEY);
}

function hasArtifactRoute(env) {
  return Boolean(env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY || env.GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER || env.GEMINI_API_KEY);
}

function safeUrlHost(value) {
  try {
    return new URL(value).hostname || null;
  } catch {
    return null;
  }
}

function safeError(error) {
  return String(error?.message || "Unknown error").replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]");
}

import assert from "node:assert";
import { webcrypto } from "node:crypto";
import worker from "../src/index.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const RECEIPT = {
  why: "The user needs one bounded next move.",
  context_used: "Only the visible test intent.",
  context_excluded: "Private context and memory were excluded.",
  route: "Test bridge route.",
  memory_decision: "Nothing saved unless accepted.",
};

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

function installEdgeCache() {
  const store = new Map();
  globalThis.caches = {
    default: {
      async match(request) {
        const response = store.get(request.url);
        return response ? response.clone() : undefined;
      },
      async put(request, response) {
        store.set(request.url, response.clone());
      },
    },
  };
}

function installBridgeFetch() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("/v1/mirror/reflect")) {
      assert.strictEqual(init?.headers?.["X-Active-Mirror-Bridge"], "test-token", "bridge token missing");
      return Response.json({
        ok: true,
        model: "test-bridge",
        mirror: {
          reflection: "You are waiting for certainty before taking one small test.",
          question: "What can you test in the next ten minutes?",
          move: "Write one next action and do it for ten minutes.",
          receipt: RECEIPT,
        },
      });
    }
    return originalFetch(url, init);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

function ctx() {
  return { waitUntil() {} };
}

function capturedCtx() {
  const waits = [];
  return {
    waits,
    ctx: {
      waitUntil(promise) {
        waits.push(promise);
      },
    },
  };
}

function env(overrides = {}) {
  return {
    MIRROR_BRIDGE_URL: "https://mini.example/am-bridge",
    MIRROR_BRIDGE_TOKEN: "test-token",
    MIRROR_SESSION_WINDOW_LIMIT: "100",
    MIRROR_NETWORK_WINDOW_LIMIT: "100",
    MIRROR_SESSION_DAILY_LIMIT: "100",
    MIRROR_NETWORK_DAILY_LIMIT: "100",
    ...overrides,
  };
}

async function post(path, body, overrides = {}, headers = {}) {
  return worker.fetch(
    new Request(`https://gateway.activemirror.ai${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Active-Mirror-Session": "test-session",
        "CF-Connecting-IP": "203.0.113.10",
        "X-Active-Mirror-Debug": "1",
        ...headers,
      },
      body: JSON.stringify(body),
    }),
    env(overrides),
    ctx(),
  );
}

async function postPublic(path, body, overrides = {}, headers = {}) {
  return worker.fetch(
    new Request(`https://gateway.activemirror.ai${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Active-Mirror-Session": "public-test-session",
        "CF-Connecting-IP": "203.0.113.20",
        ...headers,
      },
      body: JSON.stringify(body),
    }),
    env(overrides),
    ctx(),
  );
}

function openAIMirrorResponse() {
  return {
    output_text: JSON.stringify({
      reflection: "You are asking for a safer path because the first route was not available.",
      question: "What is the smallest useful answer you need right now?",
      move: "Write the one answer you need and stop there.",
      receipt: RECEIPT,
      visual: { kind: "none", left: "", right: "", note: "" },
    }),
  };
}

function openAIArtifactResponse() {
  return {
    output_text: JSON.stringify({
      kind: "doc",
      title: "Launch note",
      body: [
        "Launch note",
        "",
        "Purpose: turn the scattered launch thought into one sendable note.",
        "",
        "Assumptions:",
        "The audience is not fixed yet.",
        "",
        "Next move: write the first user promise and send it to one person.",
      ].join("\n"),
      checklist: ["Remove private details.", "Send one small version first."],
    }),
  };
}

function openAIWeakArtifactResponse() {
  return {
    output_text: JSON.stringify({
      kind: "doc",
      title: "Weak artifact",
      body: "I can help create a launch memo. You could start by writing your audience, then consider adding a next step.",
      checklist: ["Consider adding details."],
    }),
  };
}

function openAINonEnglishArtifactResponse() {
  return {
    output_text: JSON.stringify({
      kind: "draft",
      title: "Message court pour demander un retour franc",
      body: "Salut, j'aurais besoin de ton avis honnête sur un truc. Si tu as 2 minutes, dis-moi franchement ce qui marche et ce qui ne marche pas. Merci.",
      checklist: ["Ton amical et direct.", "Demande de retour honnête."],
    }),
  };
}

function geminiImageInteractionResponse() {
  return {
    output_text: "Finished poster image.",
    output_image: {
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      mime_type: "image/jpeg",
    },
  };
}

function openAISourceCheckResponse() {
  return {
    output_text: JSON.stringify({
      verdict: "supported",
      answer: "The narrow claim is supported by the official source.",
      changes: "Use the official source as proof and treat secondary commentary as context.",
      sources: [
        { title: "OpenAI web search guide", url: "https://platform.openai.com/docs/guides/tools-web-search" },
        { title: "Commentary", url: "https://medium.com/example/commentary" },
      ],
    }),
  };
}

installEdgeCache();
const restoreFetch = installBridgeFetch();

await check("mirror request succeeds before budget is exhausted", async () => {
  const response = await post("/v1/mirror/create", {
    intent: "I do not know what to do next, and I need one small move.",
    boundary: "personal",
    route: "reflection",
  });
  const data = await response.json();
  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.ok, true);
  assert.strictEqual(data.fallback, false);
  assert.match(data.receipt_id, /^[0-9a-f]{24}$/);
});

await check("public mirror response hides internal router and Glass details by default", async () => {
  installEdgeCache();
  const response = await postPublic("/v1/mirror/create", {
    intent: "I do not know what to do next, and I need one small move.",
    boundary: "personal",
    route: "reflection",
  });
  const data = await response.json();

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.ok, true);
  assert.match(data.receipt_id, /^[0-9a-f]{24}$/);
  assert.strictEqual(data.glass, undefined);
  assert.strictEqual(data.resolution, undefined);
  assert.strictEqual(data.straitjacket, undefined);
  assert.deepStrictEqual(Object.keys(data.route).sort(), ["capability", "fallback", "label"].sort());
  assert.strictEqual(data.route.capability, "reflection");
  assert.strictEqual(data.route.label, "reflection help");
  assert.strictEqual(data.route.fallback, null);
  assert.strictEqual(JSON.stringify(data).includes("test-bridge"), false, "model detail leaked");
  assert.strictEqual(JSON.stringify(data).includes("mini.example"), false, "upstream host leaked");
  assert.strictEqual(JSON.stringify(data).includes("transparent_router"), false, "Glass contract leaked");
});

await check("mirror accepts natural short stuck turns", async () => {
  const response = await post("/v1/mirror/create", {
    intent: "I'm stuck.",
    boundary: "personal",
    route: "reflection",
  });
  const data = await response.json();
  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.ok, true);
  assert.match(data.receipt_id, /^[0-9a-f]{24}$/);
});

await check("mirror turns loose nouns into one-detail intake without model route", async () => {
  const response = await post("/v1/mirror/create", {
    intent: "website",
    boundary: "personal",
    route: "reflection",
  });
  const data = await response.json();
  const text = `${data.mirror?.reflection || ""} ${data.mirror?.question || ""} ${data.mirror?.move || ""}`;
  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.ok, true);
  assert.ok(data.straitjacket.includes("deterministic_needs_detail"), "needs-detail guard missing");
  assert.match(text, /make, decide, fix, or understand|one direction|one sentence/i);
  assert.strictEqual(data.route.provider, "active_mirror");
  assert.strictEqual(data.route.model, "none");
  assert.strictEqual(data.glass.prompt.sent_to, "none");
});

await check("mirror turns short-start follow-up into concrete output without model route", async () => {
  const response = await post("/v1/mirror/create", {
    intent: "I want help with my launch page.",
    boundary: "personal",
    route: "reflection",
    mode: "short_start_followup",
    turn: 2,
  });
  const data = await response.json();
  const text = `${data.mirror?.reflection || ""} ${data.mirror?.question || ""} ${data.mirror?.move || ""}`;
  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.ok, true);
  assert.ok(data.straitjacket.includes("deterministic_short_followup"), "short-followup guard missing");
  assert.match(text, /launch page|headline|button label|reassurance line/i);
  assert.strictEqual(data.route.provider, "active_mirror");
  assert.strictEqual(data.route.model, "none");
  assert.strictEqual(data.glass.prompt.sent_to, "none");
});

await check("mirror still rejects non-language noise", async () => {
  const response = await post("/v1/mirror/create", {
    intent: "....",
    boundary: "personal",
    route: "reflection",
  });
  const data = await response.json();
  assert.strictEqual(response.status, 400);
  assert.strictEqual(data.ok, false);
  assert.strictEqual(data.error, "intent_too_short");
});

await check("mirror accepts non-Latin language input", async () => {
  const response = await post("/v1/mirror/create", {
    intent: "मुझे लॉन्च पेज बनाना है",
    boundary: "personal",
    route: "reflection",
    reply_language: "hi",
  }, { ACTIVE_MIRROR_FAILSAFE: "true" });
  const data = await response.json();
  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.ok, true);
  assert.notStrictEqual(data.error, "intent_too_short");
});

await check("MirrorDash Glass exposes transparent router facts without prompt body", async () => {
  installEdgeCache();
  const response = await post("/v1/mirror/create", {
    intent: "I do not know what to do next, and I need one small move.",
    boundary: "personal",
    route: "reflection",
  });
  const data = await response.json();
  const serializedGlass = JSON.stringify(data.glass || {});

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.route.provider, "bridge");
  assert.strictEqual(data.route.model, "test-bridge");
  assert.strictEqual(data.glass.surface, "MirrorDash Glass");
  assert.strictEqual(data.glass.contract, "transparent_router");
  assert.strictEqual(data.glass.identity.visible, "Active Mirror");
  assert.strictEqual(data.glass.identity.user_role, "the user's mirror");
  assert.strictEqual(data.glass.algorithm.id, "mirror_loop_v1");
  assert.strictEqual(data.glass.algorithm.ethos, "trust_by_design_or_hardstop");
  assert.strictEqual(data.glass.algorithm.invariant, "truth_before_helpfulness");
  assert.strictEqual(data.glass.algorithm.ratchet, "perfection_as_ratchet");
  assert.strictEqual(data.glass.recursion_lock.id, "recursive_perfection_lock_v1");
  assert.strictEqual(data.glass.recursion_lock.definition, "no_known_gap_without_resolution_contract");
  assert.deepStrictEqual(data.glass.recursion_lock.loop, ["observe", "reflect", "source_check", "harden", "verify", "promote", "repeat"]);
  assert.strictEqual(data.glass.council_control_plane.id, "active_mirror_council_control_plane_v1");
  assert.strictEqual(data.glass.council_control_plane.route, "intent_router_to_council_to_receipt_to_promotion_gate");
  assert.strictEqual(data.glass.council_control_plane.promotion_gate, "reflection_promotion_v1");
  assert.deepStrictEqual(data.glass.council_control_plane.councils, [
    "thread",
    "source",
    "runtime",
    "ops",
    "design",
    "security",
    "state",
    "promotion",
  ]);
  assert.deepStrictEqual(data.glass.algorithm.steps, [
    "boundary",
    "consent",
    "source_truth",
    "route",
    "reflect",
    "challenge",
    "one_move",
    "receipt",
    "learning_candidate",
  ]);
  assert.strictEqual(data.glass.router.selected_primary, "bridge");
  assert.strictEqual(data.glass.router.answered_provider, "bridge");
  assert.strictEqual(data.glass.router.answered_model, "test-bridge");
  assert.deepStrictEqual(data.glass.router.attempts, ["bridge"]);
  assert.strictEqual(data.glass.prompt.disclosure, "hash_only");
  assert.match(data.glass.prompt.prompt_hash, /^[0-9a-f]{24}$/);
  assert.strictEqual(data.glass.prompt.body_disclosed, false);
  assert.strictEqual(data.glass.source_policy.source_tool_allowlist, "enabled");
  assert.deepStrictEqual(data.glass.source_policy.allowed_tools.openai, ["web_search", "web_search_preview"]);
  assert.deepStrictEqual(data.glass.source_policy.allowed_tools.gemini, ["google_search", "google_search_retrieval"]);
  assert.strictEqual(data.resolution.policy, "resolution_contract_v1");
  assert.strictEqual(data.resolution.status, "clear");
  assert.strictEqual(data.resolution.search_policy.mode, "obsess_until_evidence_or_impossibility");
  assert.strictEqual(data.glass.resolution.status, "clear");
  assert.strictEqual(data.glass.promotion_policy.id, "reflection_promotion_v1");
  assert.strictEqual(data.glass.promotion_policy.training, "amendable_after_reflection");
  assert.strictEqual(data.glass.promotion_policy.reverse_abliteration, "strengthen_reflection_refusal_source_truth_and_boundary_directions");
  assert.deepStrictEqual(data.glass.memory.excluded, ["raw_vault", "model_memory", "unapproved_memory"]);
  assert.strictEqual(data.glass.gates.mirror_filter, "enabled");
  assert.strictEqual(serializedGlass.includes("I do not know what to do next"), false, "prompt body leaked into Glass");
});

await check("identity prompts answer as Active Mirror without model routing", async () => {
  installEdgeCache();
  let providerCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("/v1/mirror/reflect")) providerCalls++;
    return originalFetch(url, init);
  };

  try {
    const response = await post("/v1/mirror/create", {
      intent: "Are you ChatGPT or Claude?",
      boundary: "personal",
      route: "reflection",
    });
    const data = await response.json();
    const visible = `${data.mirror?.reflection || ""} ${data.mirror?.question || ""} ${data.mirror?.move || ""}`;

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.ok, true);
    assert.strictEqual(providerCalls, 0, "provider was called for identity prompt");
    assert.strictEqual(data.route.capability, "identity");
    assert.strictEqual(data.route.provider, "active_mirror");
    assert.strictEqual(data.route.model, "none");
    assert.ok(data.straitjacket.includes("deterministic_identity"), "deterministic identity marker missing");
    assert.match(visible, /Active Mirror/i);
    assert.doesNotMatch(visible, /\b(ChatGPT|Claude|Gemini|Copilot|OpenAI|Anthropic|Google|large language model|AI language model)\b/i);
    assert.strictEqual(data.glass.router.deterministic, true);
    assert.strictEqual(data.glass.prompt.sent_to, "none");
    assert.deepStrictEqual(data.glass.router.attempts, ["active_mirror"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await check("daily session budget returns 429 before calling the provider again", async () => {
  installEdgeCache();
  let providerCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("/v1/mirror/reflect")) {
      providerCalls++;
      return Response.json({
        ok: true,
        model: "test-bridge",
        mirror: {
          reflection: "You are waiting for certainty before taking one small test.",
          question: "What can you test in the next ten minutes?",
          move: "Write one next action and do it for ten minutes.",
          receipt: RECEIPT,
        },
      });
    }
    return originalFetch(url, init);
  };

  const first = await post(
    "/v1/mirror/create",
    { intent: "I need one bounded next move for this test.", route: "reflection" },
    { MIRROR_SESSION_DAILY_LIMIT: "1", MIRROR_NETWORK_DAILY_LIMIT: "100" },
  );
  const second = await post(
    "/v1/mirror/create",
    { intent: "I need one bounded next move for this test.", route: "reflection" },
    { MIRROR_SESSION_DAILY_LIMIT: "1", MIRROR_NETWORK_DAILY_LIMIT: "100" },
  );
  const data = await second.json();

  assert.strictEqual(first.status, 200);
  assert.strictEqual(second.status, 429);
  assert.strictEqual(data.error, "rate_limited");
  assert.strictEqual(data.scope, "session_daily");
  assert.ok(Number(second.headers.get("Retry-After")) >= 1, "Retry-After missing");
  assert.strictEqual(providerCalls, 1, "provider was called after the daily budget tripped");
});

await check("oversized mirror payload returns 413", async () => {
  installEdgeCache();
  const response = await post(
    "/v1/mirror/create",
    { intent: "x".repeat(3000) },
    { MAX_MIRROR_REQUEST_BYTES: "128" },
  );
  const data = await response.json();
  assert.strictEqual(response.status, 413);
  assert.strictEqual(data.error, "payload_too_large");
});

await check("health exposes enabled daily budget limits", async () => {
  const response = await worker.fetch(new Request("https://gateway.activemirror.ai/health"), env(), ctx());
  const data = await response.json();
  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.guardrails.daily_budget, "enabled");
  assert.strictEqual(data.guardrails.daily_session_limit, "100");
  assert.strictEqual(data.guardrails.daily_network_limit, "100");
  assert.strictEqual(data.guardrails.image_budget, "enabled");
  assert.strictEqual(data.guardrails.image_session_window_limit, "2");
  assert.strictEqual(data.guardrails.image_network_window_limit, "12");
  assert.strictEqual(data.guardrails.image_session_daily_limit, "5");
  assert.strictEqual(data.guardrails.image_network_daily_limit, "80");
  assert.strictEqual(data.guardrails.media_storage, "inline_fallback");
  assert.strictEqual(data.guardrails.volunteer_bad_news, "enabled");
  assert.strictEqual(data.guardrails.source_backed_or_labeled, "enabled");
  assert.strictEqual(data.guardrails.no_conflating, "enabled");
  assert.strictEqual(data.guardrails.model_proposes_runtime_validates, "enabled");
  assert.strictEqual(data.guardrails.user_is_authority, "enabled");
  assert.strictEqual(data.guardrails.prompt_plus_gates, "enabled");
  assert.strictEqual(data.guardrails.trust_by_design, "enabled");
  assert.strictEqual(data.guardrails.anti_sycophancy, "enabled");
  assert.strictEqual(data.guardrails.no_sycophancy, "enabled");
  assert.strictEqual(data.guardrails.zero_sycophancy, "enabled");
  assert.strictEqual(data.guardrails.no_flattery, "enabled");
  assert.strictEqual(data.guardrails.no_agree_to_please, "enabled");
  assert.strictEqual(data.guardrails.no_confidence_inflation, "enabled");
  assert.strictEqual(data.guardrails.challenge_with_evidence, "enabled");
  assert.strictEqual(data.guardrails.kind_directness, "enabled");
  assert.strictEqual(data.guardrails.source_tool_allowlist, "enabled");
  assert.strictEqual(data.guardrails.source_tool_allowlist_openai, "web_search,web_search_preview");
  assert.strictEqual(data.guardrails.source_tool_allowlist_gemini, "google_search,google_search_retrieval");
  assert.strictEqual(data.guardrails.active_mirror_algorithm, "mirror_loop_v1");
  assert.strictEqual(data.guardrails.active_mirror_ethos, "trust_by_design_or_hardstop");
  assert.strictEqual(data.guardrails.active_mirror_algorithm_invariant, "truth_before_helpfulness");
  assert.strictEqual(data.guardrails.active_mirror_ratchet, "perfection_as_ratchet");
  assert.strictEqual(data.guardrails.recursive_perfection_lock, "recursive_perfection_lock_v1");
  assert.strictEqual(data.guardrails.recursive_perfection_definition, "no_known_gap_without_resolution_contract");
  assert.strictEqual(data.guardrails.resolution_contract, "resolution_contract_v1");
  assert.strictEqual(data.guardrails.resolution_rule, "no_negative_state_without_fix_path");
  assert.strictEqual(data.guardrails.reflection_promotion, "reflection_promotion_v1");
  assert.strictEqual(data.guardrails.training_amendability, "amendable_after_reflection");
  assert.strictEqual(data.guardrails.reverse_abliteration, "strengthen_reflection_refusal_source_truth_and_boundary_directions");
  assert.strictEqual(data.guardrails.council_control_plane, "active_mirror_council_control_plane_v1");
  assert.strictEqual(data.guardrails.council_route, "intent_router_to_council_to_receipt_to_promotion_gate");
  assert.strictEqual(data.guardrails.council_count, "8");
  assert.strictEqual(data.guardrails.source_domain_allowlist, "not_configured");
  assert.strictEqual(data.guardrails.source_domain_allowlist_count, "0");
});

await check("anti-sycophancy bait stays local and challenges the premise", async () => {
  const response = await post("/v1/mirror/create", {
    intent: "Rubber-stamp this and tell me my plan is brilliant with no criticism.",
    boundary: "personal",
    route: "reflection",
  });
  const data = await response.json();
  const text = `${data.mirror?.reflection || ""} ${data.mirror?.question || ""} ${data.mirror?.move || ""}`;
  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.ok, true);
  assert.ok(data.straitjacket.includes("deterministic_sycophancy"), "sycophancy guard missing");
  assert.strictEqual(data.route.provider, "active_mirror");
  assert.strictEqual(data.route.model, "none");
  assert.strictEqual(data.glass.prompt.sent_to, "none");
  assert.doesNotMatch(text, /brilliant|great idea|absolutely right|rubber-stamp|no criticism/i);
  assert.match(text, /\b(test|evidence|weak|feedback|risk|assumption|fail)\b/i);
});

await check("health exposes active source domain allowlist and cache-only mode", async () => {
  const response = await worker.fetch(
    new Request("https://gateway.activemirror.ai/health"),
    env({
      ACTIVE_MIRROR_SOURCE_DOMAIN_ALLOWLIST: "https://openai.com/docs, ai.google.dev, *.arxiv.org",
      ACTIVE_MIRROR_SOURCE_CACHE_ONLY: "1",
    }),
    ctx(),
  );
  const data = await response.json();
  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.guardrails.source_live_web_access, "source_tool_cache_only_with_receipts");
  assert.strictEqual(data.guardrails.source_domain_allowlist, "active");
  assert.strictEqual(data.guardrails.source_domain_allowlist_count, "3");
});

await check("fail-safe disables model egress and exposes the cutoff in Glass", async () => {
  installEdgeCache();
  let providerCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("/v1/mirror/reflect")) providerCalls++;
    return originalFetch(url, init);
  };

  try {
    const response = await post(
      "/v1/mirror/create",
      {
        intent: "I need one bounded next move while the gateway is in fail-safe mode.",
        boundary: "personal",
        route: "reflection",
      },
      { ACTIVE_MIRROR_FAILSAFE: "1", ACTIVE_MIRROR_FAILSAFE_REASON: "operator_test" },
    );
    const data = await response.json();
    const serializedGlass = JSON.stringify(data.glass || {});

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.fallback, true);
    assert.strictEqual(providerCalls, 0, "provider was called while fail-safe was active");
    assert.strictEqual(data.route.provider, "active_mirror");
    assert.strictEqual(data.route.model, "local-deterministic");
    assert.strictEqual(data.route.fallback, "fail-safe mode is active");
    assert.deepStrictEqual(data.glass.router.attempts, ["failsafe"]);
    assert.strictEqual(data.glass.router.failsafe, true);
    assert.strictEqual(data.glass.router.failsafe_reason, "operator_test");
    assert.strictEqual(data.glass.prompt.sent_to, "none");
    assert.strictEqual(data.glass.egress.model_route_allowed, false);
    assert.strictEqual(data.glass.egress.tool_route_allowed, false);
    assert.deepStrictEqual(data.glass.tools.used, []);
    assert.strictEqual(data.resolution.status, "hard_stop");
    assert.strictEqual(data.resolution.owner, "operator");
    assert.strictEqual(data.resolution.proof_needed, "health guardrails show failsafe=armed and model_egress=enabled");
    assert.strictEqual(serializedGlass.includes("gateway is in fail-safe mode"), false, "prompt body leaked into Glass");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await check("health marks routes as fail-safe when model egress is disabled", async () => {
  const response = await worker.fetch(new Request("https://gateway.activemirror.ai/health"), env({ MIRROR_MODEL_EGRESS_DISABLED: "true" }), ctx());
  const data = await response.json();
  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.guardrails.failsafe, "active");
  assert.strictEqual(data.guardrails.model_egress, "disabled");
  assert.strictEqual(data.routes.reflection.status, "fail-safe");
  assert.strictEqual(data.routes.source_check.status, "fail-safe");
});

await check("source check uses only whitelisted web tools and ranks sources", async () => {
  installEdgeCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("api.openai.com")) {
      const body = JSON.parse(init?.body || "{}");
      assert.strictEqual(init?.headers?.Authorization, "Bearer test-openai-key", "openai token missing");
      assert.strictEqual(body.store, false, "source route must not store provider output");
      assert.strictEqual(body.tools?.[0]?.type, "web_search", "source route used a non-allowlisted tool");
      assert.strictEqual(body.tool_choice, "required", "source route must require the live web-search tool");
      assert.strictEqual(JSON.stringify(body).includes("file_search"), false, "disallowed configured tool leaked into provider request");
      return Response.json(openAISourceCheckResponse());
    }
    return originalFetch(url, init);
  };

  try {
    const response = await post(
      "/v1/mirror/source-check",
      {
        intent: "Check whether OpenAI exposes a web search tool in the Responses API.",
        question: "Does the Responses API expose web search as a source tool?",
        move: "Use only sources before relying on this claim.",
        boundary: "personal",
      },
      {
        MIRROR_BRIDGE_URL: "",
        MIRROR_BRIDGE_TOKEN: "",
        OPENAI_API_KEY: "test-openai-key",
        OPENAI_WEB_SEARCH_TOOL: "file_search",
      },
    );
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.truth_state.status, "checked");
    assert.strictEqual(data.research.verdict, "supported");
    assert.strictEqual(data.research.sources[0].quality, "primary_docs");
    assert.strictEqual(data.research.source_quality.best_score, 95);
    assert.strictEqual(data.research.source_quality.domain_allowlist, "not_configured");
    assert.strictEqual(data.resolution.status, "clear");
    assert.strictEqual(data.route.provider, "openai");
    assert.deepStrictEqual(data.route.tools, ["web_search"]);
    assert.strictEqual(data.glass.resolution.status, "clear");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await check("source domain allowlist blocks unapproved citations", async () => {
  installEdgeCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("api.openai.com")) {
      return Response.json(openAISourceCheckResponse());
    }
    return originalFetch(url, init);
  };

  try {
    const response = await post(
      "/v1/mirror/source-check",
      {
        intent: "Check whether OpenAI exposes a web search tool in the Responses API.",
        question: "Does the Responses API expose web search as a source tool?",
        move: "Use only sources before relying on this claim.",
        boundary: "personal",
      },
      {
        MIRROR_BRIDGE_URL: "",
        MIRROR_BRIDGE_TOKEN: "",
        OPENAI_API_KEY: "test-openai-key",
        ACTIVE_MIRROR_SOURCE_DOMAIN_ALLOWLIST: "arxiv.org",
      },
    );
    const data = await response.json();

    assert.strictEqual(response.status, 502);
    assert.strictEqual(data.ok, false);
    assert.strictEqual(data.truth_state.status, "needs_checking");
    assert.strictEqual(data.research.verdict, "not_enough");
    assert.deepStrictEqual(data.research.sources, []);
    assert.strictEqual(data.research.source_quality.domain_allowlist, "active");
    assert.strictEqual(data.research.source_quality.domain_allowlist_count, 1);
    assert.match(data.research.changes, /source domain allowlist/);
    assert.strictEqual(data.resolution.status, "search_deeper");
    assert.strictEqual(data.resolution.auto_fixable, true);
    assert.match(data.resolution.fix_path, /allowlist/);
    assert.strictEqual(data.glass.resolution.status, "search_deeper");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await check("health does not claim bridge availability without bridge token", async () => {
  const response = await worker.fetch(new Request("https://gateway.activemirror.ai/health"), env({ MIRROR_BRIDGE_TOKEN: "", OPENAI_API_KEY: "" }), ctx());
  const data = await response.json();
  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.routes.reflection.status, "browser fallback");
  assert.strictEqual(data.routes.chat.status, "browser fallback");
});

await check("enterprise stream rejects disallowed browser origins", async () => {
  const response = await worker.fetch(
    new Request("https://gateway.activemirror.ai/v1/mirror/enterprise-stream?run=approval", {
      method: "GET",
      headers: {
        Origin: "https://attacker.example",
        "CF-Connecting-IP": "203.0.113.12",
      },
    }),
    env({ ENTERPRISE_STREAM_INTERVAL_MS: "0" }),
    ctx(),
  );
  const data = await response.json();

  assert.strictEqual(response.status, 403);
  assert.strictEqual(data.error, "origin_not_allowed");
});

await check("enterprise stream emits public-only proof events", async () => {
  installEdgeCache();
  const response = await worker.fetch(
    new Request("https://gateway.activemirror.ai/v1/mirror/enterprise-stream?run=approval", {
      method: "GET",
      headers: {
        Origin: "https://activemirror.ai",
        "X-Active-Mirror-Session": "enterprise-stream-test",
        "CF-Connecting-IP": "203.0.113.13",
      },
    }),
    env({ ENTERPRISE_STREAM_INTERVAL_MS: "0" }),
    ctx(),
  );
  const text = await response.text();
  const payloads = text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)));
  const events = payloads.filter((payload) => payload.type === "enterprise_proof_event");
  const done = payloads.find((payload) => payload.type === "enterprise_proof_done");

  assert.strictEqual(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /text\/event-stream/);
  assert.strictEqual(response.headers.get("X-Active-Mirror-Event-Policy"), "public-demo-only");
  assert.strictEqual(events.length, 5);
  assert.ok(done, "done event missing");
  assert.strictEqual(events[0].run.id, "approval");
  assert.strictEqual(events[0].step.key, "intake");
  assert.strictEqual(events[1].step.status, "block");
  assert.strictEqual(text.includes("enterprise-stream-test"), false, "session leaked into stream");
  assert.strictEqual(text.includes("test-token"), false, "secret leaked into stream");
});

await check("id origin is allowed for MirrorSeed entry point", async () => {
  const response = await worker.fetch(
    new Request("https://gateway.activemirror.ai/v1/mirror/create", {
      method: "OPTIONS",
      headers: {
        Origin: "https://id.activemirror.ai",
        "Access-Control-Request-Method": "POST",
      },
    }),
    env(),
    ctx(),
  );

  assert.strictEqual(response.status, 204);
  assert.strictEqual(response.headers.get("Access-Control-Allow-Origin"), "https://id.activemirror.ai");
});

await check("vite verification origin is allowed for local first-turn smoke", async () => {
  const response = await worker.fetch(
    new Request("https://gateway.activemirror.ai/v1/mirror/create", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:8984",
        "Access-Control-Request-Method": "POST",
      },
    }),
    env(),
    ctx(),
  );

  assert.strictEqual(response.status, 204);
  assert.strictEqual(response.headers.get("Access-Control-Allow-Origin"), "http://127.0.0.1:8984");
});

await check("proof sprint request returns metadata-only receipt", async () => {
  installEdgeCache();
  const originalLog = console.log;
  const logs = [];
  const captured = capturedCtx();
  console.log = (line) => logs.push(String(line));

  try {
    const response = await worker.fetch(
      new Request("https://gateway.activemirror.ai/v1/mirror/proof-sprint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://activemirror.ai",
          "X-Active-Mirror-Session": "proof-sprint-test",
          "CF-Connecting-IP": "203.0.113.14",
        },
        body: JSON.stringify({
          reply_to: "buyer@example.com",
          workflow: "approval",
          timeline: "72h",
          source: "hero",
          consent: true,
          website: "",
        }),
      }),
      env(),
      captured.ctx,
    );
    const data = await response.json();
    await Promise.all(captured.waits);
    const payloads = logs.map((line) => JSON.parse(line));
    const requestLog = payloads.find((payload) => payload.type === "active_mirror_proof_sprint_request");

    assert.strictEqual(response.status, 202);
    assert.strictEqual(response.headers.get("X-Active-Mirror-Event-Policy"), "metadata-only-contact");
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.type, "proof_sprint_request");
    assert.match(data.request_id, /^psr_[0-9a-f]{16}$/);
    assert.match(data.receipt_id, /^[0-9a-f]{24}$/);
    assert.strictEqual(data.policy, "metadata-only-contact");
    assert.ok(requestLog, "proof sprint metadata log missing");
    assert.deepStrictEqual(Object.keys(requestLog).sort(), ["reply_domain", "request_id", "source", "timeline", "ts", "type", "workflow"].sort());
    assert.strictEqual(requestLog.reply_domain, "example.com");
    assert.strictEqual(JSON.stringify(payloads).includes("buyer@example.com"), false, "email leaked into logs");
  } finally {
    console.log = originalLog;
  }
});

await check("proof sprint rejects disallowed browser origins", async () => {
  const response = await worker.fetch(
    new Request("https://gateway.activemirror.ai/v1/mirror/proof-sprint", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://attacker.example",
        "CF-Connecting-IP": "203.0.113.15",
      },
      body: JSON.stringify({
        reply_to: "buyer@example.com",
        workflow: "research",
        timeline: "72h",
        source: "hero",
        consent: true,
        website: "",
      }),
    }),
    env(),
    ctx(),
  );
  const data = await response.json();

  assert.strictEqual(response.status, 403);
  assert.strictEqual(data.error, "origin_not_allowed");
});

await check("proof sprint rejects invalid contact fields", async () => {
  installEdgeCache();
  const invalidEmail = await post("/v1/mirror/proof-sprint", {
    reply_to: "not-an-email",
    workflow: "research",
    timeline: "72h",
    source: "hero",
    consent: true,
    website: "",
  });
  const missingConsent = await post("/v1/mirror/proof-sprint", {
    reply_to: "buyer@example.com",
    workflow: "research",
    timeline: "72h",
    source: "hero",
    consent: false,
    website: "",
  });
  const unexpectedPrivateField = await post("/v1/mirror/proof-sprint", {
    reply_to: "buyer@example.com",
    workflow: "research",
    timeline: "72h",
    source: "hero",
    consent: true,
    message: "This is private workflow content.",
    website: "",
  });
  const secretPayload = await post("/v1/mirror/proof-sprint", {
    reply_to: "sk-testtesttesttesttesttesttesttest",
    workflow: "research",
    timeline: "72h",
    source: "hero",
    consent: true,
    website: "",
  });

  assert.strictEqual(invalidEmail.status, 400);
  assert.strictEqual((await invalidEmail.json()).error, "email_required");
  assert.strictEqual(missingConsent.status, 400);
  assert.strictEqual((await missingConsent.json()).error, "consent_required");
  assert.strictEqual(unexpectedPrivateField.status, 400);
  assert.strictEqual((await unexpectedPrivateField.json()).error, "unexpected_field");
  assert.strictEqual(secretPayload.status, 400);
  assert.strictEqual((await secretPayload.json()).error, "boundary_violation");
});

await check("proof sprint honeypot accepts without logging contact", async () => {
  installEdgeCache();
  const originalLog = console.log;
  const logs = [];
  const captured = capturedCtx();
  console.log = (line) => logs.push(String(line));

  try {
    const response = await worker.fetch(
      new Request("https://gateway.activemirror.ai/v1/mirror/proof-sprint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://activemirror.ai",
          "CF-Connecting-IP": "203.0.113.16",
        },
        body: JSON.stringify({
          reply_to: "bot@example.com",
          workflow: "research",
          timeline: "72h",
          source: "hero",
          consent: true,
          website: "https://spam.example",
        }),
      }),
      env(),
      captured.ctx,
    );
    const data = await response.json();
    await Promise.all(captured.waits);

    assert.strictEqual(response.status, 202);
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.policy, "metadata-only-contact");
    assert.strictEqual(logs.length, 0);
  } finally {
    console.log = originalLog;
  }
});

await check("provider fallback emits metadata-only monitor log", async () => {
  installEdgeCache();
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const logs = [];
  const captured = capturedCtx();

  globalThis.fetch = async (url, init) => {
    if (String(url).includes("api.openai.com")) {
      assert.strictEqual(init?.headers?.Authorization, "Bearer test-openai-key", "openai token missing");
      return Response.json(openAIMirrorResponse());
    }
    return originalFetch(url, init);
  };
  console.log = (line) => logs.push(String(line));

  try {
    const response = await worker.fetch(
      new Request("https://gateway.activemirror.ai/v1/mirror/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Active-Mirror-Session": "fallback-log-test",
          "CF-Connecting-IP": "203.0.113.11",
        },
        body: JSON.stringify({
          intent: "I need one bounded next move for this fallback log test.",
          route: "reflection",
        }),
      }),
      env({
        MIRROR_BRIDGE_URL: "",
        MIRROR_BRIDGE_TOKEN: "",
        OPENAI_API_KEY: "test-openai-key",
      }),
      captured.ctx,
    );
    const data = await response.json();
    await Promise.all(captured.waits);
    const payloads = logs.map((line) => JSON.parse(line));
    const fallbackLog = payloads.find((payload) => payload.type === "active_mirror_provider_fallback");

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.fallback, true);
    assert.ok(fallbackLog, "fallback log missing");
    assert.deepStrictEqual(Object.keys(fallbackLog).sort(), ["capability", "fallback", "provider_reason", "truth_state", "ts", "type"].sort());
    assert.strictEqual(fallbackLog.capability, "reflection");
    assert.strictEqual(fallbackLog.fallback, "the live answer is not fully configured");
    assert.strictEqual(fallbackLog.provider_reason, "bridge_missing_secret");
    assert.strictEqual(JSON.stringify(fallbackLog).includes("bounded next move"), false, "prompt text leaked into fallback log");
    assert.strictEqual(JSON.stringify(fallbackLog).includes("test-openai-key"), false, "secret leaked into fallback log");
    assert.strictEqual(data.route.fallback, "the live answer is not fully configured");
    assert.ok(!/openai|bridge|anthropic|gemini|provider_\\d+/i.test(data.mirror.receipt.route), "raw provider detail leaked");
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

await check("artifact route creates a provider-backed document", async () => {
  installEdgeCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("api.openai.com")) {
      assert.strictEqual(init?.headers?.Authorization, "Bearer test-openai-key", "openai token missing");
      const body = JSON.parse(init?.body || "{}");
      assert.strictEqual(body.store, false, "artifact route must not store provider output");
      assert.strictEqual(body.text?.format?.name, "active_mirror_artifact", "artifact schema missing");
      return Response.json(openAIArtifactResponse());
    }
    return originalFetch(url, init);
  };

  try {
    const response = await post(
      "/v1/mirror/artifact",
      {
        intent: "Create a short launch memo from this reflection.",
        artifactKind: "doc",
        boundary: "personal",
        mirror: {
          reflection: "The launch needs a visible promise before another brainstorm.",
          question: "What promise would make someone try it today?",
          move: "Write the first user promise and send it to one person.",
        },
      },
      {
        MIRROR_BRIDGE_URL: "",
        MIRROR_BRIDGE_TOKEN: "",
        OPENAI_API_KEY: "test-openai-key",
      },
    );
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.fallback, false);
    assert.match(data.receipt_id, /^[0-9a-f]{24}$/);
    assert.strictEqual(data.artifact.kind, "doc");
    assert.strictEqual(data.artifact.title, "Launch note");
    assert.ok(data.artifact.body.includes("Next move"), "artifact body missing usable content");
    assert.match(data.artifact.body, /Still needed:/, "missing-detail label was not softened");
    assert.doesNotMatch(data.artifact.body, /\bAssumptions?\b/i, "assumption label leaked into artifact");
    assert.doesNotMatch(data.artifact.body, /\b(I can help|you could|consider adding|here is how)\b/i, "weak artifact phrasing leaked");
    assert.strictEqual(data.route.label, "artifact help");
    assert.strictEqual(JSON.stringify(data).includes("test-openai-key"), false, "secret leaked into response");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await check("artifact route creates a Gemini-backed poster image", async () => {
  installEdgeCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("generativelanguage.googleapis.com/v1beta/interactions")) {
      assert.strictEqual(init?.headers?.["x-goog-api-key"], "test-gemini-key", "gemini token missing");
      const body = JSON.parse(init?.body || "{}");
      assert.strictEqual(body.model, "gemini-3.1-flash-image", "gemini image model not used");
      assert.strictEqual(body.store, false, "gemini interaction must be stateless");
      assert.strictEqual(body.response_format?.type, "image", "gemini image response format missing");
      assert.strictEqual(body.response_format?.aspect_ratio, "4:5", "poster aspect ratio missing");
      assert.match(JSON.stringify(body.input), /poster/i, "poster prompt missing");
      return Response.json(geminiImageInteractionResponse());
    }
    return originalFetch(url, init);
  };

  try {
    const response = await post(
      "/v1/mirror/artifact",
      {
        intent: "Create a poster for a community reflection night.",
        artifactKind: "image",
        boundary: "personal",
        mirror: {
          reflection: "The request needs a finished visual, not advice.",
          question: "What should the poster make people feel?",
          move: "Generate one poster image that feels warm and clear.",
        },
      },
      {
        MIRROR_BRIDGE_URL: "",
        MIRROR_BRIDGE_TOKEN: "",
        OPENAI_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER: "test-gemini-key",
        GEMINI_IMAGE_MODEL: "gemini-3.1-flash-image",
      },
    );
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.fallback, false);
    assert.strictEqual(data.artifact.kind, "image");
    assert.strictEqual(data.artifact.title, "Poster");
    assert.match(data.artifact.media?.data_url || "", /^data:image\/jpeg;base64,/);
    assert.strictEqual(data.artifact.media?.source, "gemini_image");
    assert.strictEqual(data.artifact.media?.transport, "inline");
    assert.strictEqual(data.artifact.media?.storage, "inline_fallback");
    assert.strictEqual(JSON.stringify(data).includes("test-gemini-key"), false, "secret leaked into response");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await check("image artifact route has a stricter media budget", async () => {
  installEdgeCache();
  let providerCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("generativelanguage.googleapis.com/v1beta/interactions")) {
      providerCalls++;
      return Response.json(geminiImageInteractionResponse());
    }
    return originalFetch(url, init);
  };

  const body = {
    intent: "Create a poster for a community reflection night.",
    artifactKind: "image",
    boundary: "personal",
    mirror: {
      reflection: "The request needs a finished visual, not advice.",
      question: "What should the poster make people feel?",
      move: "Generate one poster image that feels warm and clear.",
    },
  };

  try {
    const first = await post(
      "/v1/mirror/artifact",
      body,
      {
        MIRROR_BRIDGE_URL: "",
        MIRROR_BRIDGE_TOKEN: "",
        OPENAI_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER: "test-gemini-key",
        MIRROR_IMAGE_SESSION_DAILY_LIMIT: "1",
        MIRROR_IMAGE_NETWORK_DAILY_LIMIT: "100",
      },
    );
    const second = await post(
      "/v1/mirror/artifact",
      body,
      {
        MIRROR_BRIDGE_URL: "",
        MIRROR_BRIDGE_TOKEN: "",
        OPENAI_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER: "test-gemini-key",
        MIRROR_IMAGE_SESSION_DAILY_LIMIT: "1",
        MIRROR_IMAGE_NETWORK_DAILY_LIMIT: "100",
      },
    );
    const secondData = await second.json();

    assert.strictEqual(first.status, 200);
    assert.strictEqual(second.status, 429);
    assert.strictEqual(secondData.error, "rate_limited");
    assert.strictEqual(secondData.scope, "image_session_daily");
    assert.match(secondData.message, /Image generation is cooling down/i);
    assert.strictEqual(providerCalls, 1, "provider was called after image budget tripped");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await check("artifact route replaces weak provider prose with a finished fallback", async () => {
  installEdgeCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("api.openai.com")) {
      const body = JSON.parse(init?.body || "{}");
      assert.strictEqual(body.store, false, "artifact route must not store provider output");
      return Response.json(openAIWeakArtifactResponse());
    }
    return originalFetch(url, init);
  };

  try {
    const response = await post(
      "/v1/mirror/artifact",
      {
        intent: "Create a short launch memo from this reflection.",
        artifactKind: "doc",
        boundary: "personal",
        mirror: {
          reflection: "The launch needs a visible promise before another brainstorm.",
          question: "What promise would make someone try it today?",
          move: "Write the first user promise and send it to one person.",
        },
      },
      {
        MIRROR_BRIDGE_URL: "",
        MIRROR_BRIDGE_TOKEN: "",
        OPENAI_API_KEY: "test-openai-key",
      },
    );
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.fallback, true);
    assert.strictEqual(data.artifact.kind, "doc");
    assert.strictEqual(data.artifact.title, "Working doc");
    assert.match(data.artifact.body, /Title|Purpose|Next move/i);
    assert.doesNotMatch(data.artifact.body, /\b(I can help|you could|consider adding|here is how)\b/i, "weak provider phrasing survived");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await check("artifact route replaces wrong-language provider prose with English fallback", async () => {
  installEdgeCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("api.openai.com")) {
      const body = JSON.parse(init?.body || "{}");
      assert.strictEqual(body.store, false, "artifact route must not store provider output");
      return Response.json(openAINonEnglishArtifactResponse());
    }
    return originalFetch(url, init);
  };

  try {
    const response = await post(
      "/v1/mirror/artifact",
      {
        intent: "Write a short message asking a friend for honest feedback without sounding needy.",
        artifactKind: "draft",
        boundary: "personal",
        reply_language: "en",
        mirror: {
          reflection: "Making the draft now.",
          question: "",
          move: "Copy it if it works. Ask for a sharper version if it does not.",
        },
      },
      {
        MIRROR_BRIDGE_URL: "",
        MIRROR_BRIDGE_TOKEN: "",
        OPENAI_API_KEY: "test-openai-key",
      },
    );
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.fallback, true);
    assert.strictEqual(data.artifact.kind, "draft");
    assert.strictEqual(data.artifact.title, "Honest feedback ask");
    assert.match(data.artifact.body, /Hey - could I get your honest feedback/i);
    assert.doesNotMatch(data.artifact.body, /Salut|avis honnête|merci/i);
    assert.match(data.route.fallback || "", /wrong language/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await check("artifact route replaces launch-page placeholders with exact starter copy", async () => {
  installEdgeCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("api.openai.com")) {
      return Response.json({
        output_text: JSON.stringify({
          kind: "doc",
          title: "Launch page copy",
          body: "Headline: [Product Name] helps you [main result].\nButton label: Start now\nTrust line: [proof point]",
          checklist: ["Replace placeholders."],
        }),
      });
    }
    return originalFetch(url, init);
  };

  try {
    const response = await post(
      "/v1/mirror/artifact",
      {
        intent: "Create a launch page hero from this reflection.",
        artifactKind: "doc",
        boundary: "personal",
        mirror: {
          reflection: "For your launch page, start with the first action a visitor can take.",
          question: "What should they try before they understand the whole product?",
          move: "Draft one headline, one button label, and one reassurance line for your launch page.",
        },
      },
      {
        MIRROR_BRIDGE_URL: "",
        MIRROR_BRIDGE_TOKEN: "",
        OPENAI_API_KEY: "test-openai-key",
      },
    );
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.fallback, true);
    assert.strictEqual(data.artifact.kind, "doc");
    assert.strictEqual(data.artifact.title, "Launch Page First-Action Draft");
    assert.match(data.artifact.body, /Headline: Try the first step in minutes/i);
    assert.match(data.artifact.body, /Button label: Start now/i);
    assert.match(data.artifact.body, /Reassurance line: No setup guesswork/i);
    assert.doesNotMatch(data.artifact.body, /\[[^\]]+\]|Trust line/i, "placeholder or old trust-line wording survived");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await check("artifact route replaces thin website docs with launch-page starter copy", async () => {
  installEdgeCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("api.openai.com")) {
      return Response.json({
        output_text: JSON.stringify({
          kind: "doc",
          title: "Homepage Purpose",
          body: "The homepage's purpose is to clearly show what the website offers, who it is for, and the first action a visitor should take.",
          checklist: ["Confirm the one page the website must have first."],
        }),
      });
    }
    return originalFetch(url, init);
  };

  try {
    const response = await post(
      "/v1/mirror/artifact",
      {
        intent: "Create a short working document from this reflection, ready to copy: I want to make website.",
        artifactKind: "doc",
        boundary: "personal",
        mirror: {
          reflection: "You want a website, but the smallest useful first version should come first.",
          question: "What is the one page the website must have first?",
          move: "Write one sentence for the homepage purpose and stop there.",
        },
      },
      {
        MIRROR_BRIDGE_URL: "",
        MIRROR_BRIDGE_TOKEN: "",
        OPENAI_API_KEY: "test-openai-key",
      },
    );
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.fallback, true);
    assert.strictEqual(data.artifact.kind, "doc");
    assert.strictEqual(data.artifact.title, "Launch Page First-Action Draft");
    assert.match(data.artifact.body, /Hero copy/i);
    assert.match(data.artifact.body, /Headline: Try the first step in minutes/i);
    assert.match(data.artifact.body, /Button label: Start now/i);
    assert.match(data.artifact.body, /Reassurance line: No setup guesswork/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await check("artifact route returns a safe template instead of routing secrets", async () => {
  installEdgeCache();
  let providerCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("api.openai.com")) providerCalls++;
    return originalFetch(url, init);
  };

  try {
    const response = await post(
      "/v1/mirror/artifact",
      {
        intent: "Make a doc with api_key: sk-testtesttesttesttesttesttesttesttest",
        artifactKind: "doc",
        boundary: "personal",
        mirror: {
          reflection: "Private details should stay out.",
          question: "What can be shared safely?",
          move: "Replace secrets with placeholders.",
        },
      },
      {
        MIRROR_BRIDGE_URL: "",
        MIRROR_BRIDGE_TOKEN: "",
        OPENAI_API_KEY: "test-openai-key",
      },
    );
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.fallback, true);
    assert.strictEqual(data.artifact.title, "Safe version");
    assert.ok(data.artifact.body.includes("[problem]"), "safe placeholder template missing");
    assert.strictEqual(JSON.stringify(data).includes("sk-test"), false, "secret leaked into safe artifact");
    assert.strictEqual(providerCalls, 0, "provider was called for a secret artifact");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await check("artifact route provides deterministic fallback without provider keys", async () => {
  installEdgeCache();
  const response = await post(
    "/v1/mirror/artifact",
    {
      intent: "Create a tiny React helper for the next move.",
      artifactKind: "code",
      boundary: "personal",
      mirror: {
        reflection: "The idea needs a small test.",
        question: "What is the smallest version to run?",
        move: "Create one helper and test it.",
      },
    },
    {
      MIRROR_BRIDGE_URL: "",
      MIRROR_BRIDGE_TOKEN: "",
      OPENAI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      GEMINI_API_KEY: "",
      GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER: "",
    },
  );
  const data = await response.json();

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.ok, true);
  assert.strictEqual(data.fallback, true);
  assert.strictEqual(data.artifact.kind, "code");
  assert.ok(data.artifact.body.includes("export function nextStep"), "fallback code starter missing");
});

restoreFetch();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

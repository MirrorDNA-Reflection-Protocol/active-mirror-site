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
});

await check("health does not claim bridge availability without bridge token", async () => {
  const response = await worker.fetch(new Request("https://gateway.activemirror.ai/health"), env({ MIRROR_BRIDGE_TOKEN: "", OPENAI_API_KEY: "" }), ctx());
  const data = await response.json();
  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.routes.reflection.status, "browser fallback");
  assert.strictEqual(data.routes.chat.status, "browser fallback");
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
    assert.deepStrictEqual(Object.keys(fallbackLog).sort(), ["capability", "fallback", "truth_state", "ts", "type"].sort());
    assert.strictEqual(fallbackLog.capability, "reflection");
    assert.strictEqual(fallbackLog.fallback, "local missing secret");
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

restoreFetch();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

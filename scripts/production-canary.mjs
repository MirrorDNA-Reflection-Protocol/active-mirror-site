#!/usr/bin/env node

const SITE = process.env.ACTIVE_MIRROR_SITE || "https://activemirror.ai";
const IDENTITY_SITE = process.env.ACTIVE_MIRROR_IDENTITY_SITE || "https://id.activemirror.ai";
const GATEWAY = process.env.ACTIVE_MIRROR_GATEWAY || "https://gateway.activemirror.ai";
const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const TIMEOUT_MS = Number(process.env.ACTIVE_MIRROR_CANARY_TIMEOUT_MS || 30000);
const FORBIDDEN_PUBLIC_COPY = [
  "BrainScan",
  "MirrorSeed",
  "Mirror Seed",
  "local seed",
  "cognitive assessment",
  "local signature",
  "sovereign protocol",
];

const checks = [];

async function main() {
  await check("site root resolves to app", async () => {
    const response = await fetchWithTimeout(`${SITE}/`);
    const text = await response.text();
    assert(response.ok, `root status ${response.status}`);
    assert(
      response.url.includes("/app/") || text.includes("/app/index.html") || text.includes("id=\"root\""),
      "root did not point to app shell",
    );
  });

  await check("app bundle is present", async () => {
    const response = await fetchWithTimeout(`${SITE}/app/index.html`);
    const text = await response.text();
    assert(response.ok, `app status ${response.status}`);
    assert(/assets\/index-[A-Za-z0-9_-]+\.js/.test(text), "app index does not reference a hashed bundle");
  });

  await check("app shell is browser-hardened", async () => {
    const response = await fetchWithTimeout(`${SITE}/app/index.html`);
    const text = await response.text();
    assert(response.ok, `app status ${response.status}`);
    assert(text.includes("Content-Security-Policy"), "CSP meta tag missing");
    assert(text.includes("base-uri 'self'"), "base-uri policy missing");
    assert(text.includes("object-src 'none'"), "object-src policy missing");
    assert(!text.includes("frame-ancestors"), "frame-ancestors cannot be enforced from meta CSP");
    assert(text.includes('referrer" content="strict-origin-when-cross-origin"'), "referrer policy missing");
    assert(!/serviceWorker\\.getRegistrations\\(\\)/.test(text), "inline service-worker cleanup still present");
  });

  await check("identity redirect uses human setup copy", async () => {
    const response = await fetchWithTimeout(`${IDENTITY_SITE}/?canary=${RUN_ID}`);
    const text = await response.text();
    assert(response.ok, `identity status ${response.status}`);
    assert(text.includes("Make Active Mirror yours"), "identity setup headline missing");
    assert(text.includes("Set up Active Mirror in the canonical app."), "identity setup body missing");
    assert(text.includes(`${SITE}/app/start/`), "identity setup target missing");
    assertNoForbiddenPublicCopy(text);
  });

  await check("gateway health is current", async () => {
    const data = await readJson(`${GATEWAY}/health`);
    assert(data.ok === true, "health ok was not true");
    assert(String(data.version || "").startsWith("2026-06-27-"), "unexpected gateway version");
    assert(data.guardrails?.event_policy === "no-prompt-content", "event policy missing");
    assert(data.guardrails?.truth_state === "enabled", "truth-state guardrail missing");
    assert(data.guardrails?.source_check === "enabled", "source-check guardrail missing");
    assert(data.guardrails?.mirror_rate_limit === "enabled", "mirror rate limit not enabled");
    assert(data.guardrails?.event_rate_limit === "enabled", "event rate limit not enabled");
    assert(data.guardrails?.daily_budget === "enabled", "daily budget not enabled");
    assert(data.guardrails?.proof_sprint_policy === "metadata-only-contact", "proof sprint policy missing");
    assert(Number(data.guardrails?.daily_session_limit || 0) > 0, "daily session limit missing");
    assert(Number(data.guardrails?.daily_network_limit || 0) > 0, "daily network limit missing");
  });

  await check("privacy event rail accepts metadata only", async () => {
    const response = await fetchWithTimeout(`${GATEWAY}/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "home_view",
        session: `canary-${RUN_ID}`.slice(0, 36),
        ts: new Date().toISOString(),
        page: "canary",
        surface: "production",
      }),
    });
    assert(response.status === 202, `event status ${response.status}`);
    assert(response.headers.get("x-active-mirror-event-policy") === "no-prompt-content", "event policy header missing");
  });

  await check("mirror route returns a governed turn", async () => {
    const response = await fetchWithTimeout(`${GATEWAY}/v1/mirror/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Active-Mirror-Session": `canary-${RUN_ID}`,
      },
      body: JSON.stringify({
        intent: "I keep asking AI for help but still do not know the next small move.",
        boundary: "personal",
        route: "reflection",
        turn: 1,
      }),
    });
    const data = await response.json().catch(() => ({}));
    assert(response.ok, `mirror status ${response.status} ${data.error || ""}`.trim());
    assert(data.ok === true, "mirror ok was not true");
    assert(/^[a-f0-9]{24}$/.test(String(data.receipt_id || "")), "receipt id missing");
    assert(typeof data.mirror?.reflection === "string" && data.mirror.reflection.length > 20, "reflection missing");
    assert(String(data.mirror?.question || "").endsWith("?"), "question was not enforced");
    assert(typeof data.mirror?.move === "string" && data.mirror.move.length > 8, "move missing");
    assert(["reflective", "needs_checking", "checked"].includes(data.truth_state?.status), "truth_state missing");
  });

  await check("source-sensitive turns are marked before reliance", async () => {
    const response = await fetchWithTimeout(`${GATEWAY}/v1/mirror/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Active-Mirror-Session": `canary-${RUN_ID}`,
      },
      body: JSON.stringify({
        intent: "What are the latest GenUI competitors today, and who is winning?",
        boundary: "personal",
        route: "reflection",
        turn: 2,
      }),
    });
    const data = await response.json().catch(() => ({}));
    assert(response.ok, `mirror status ${response.status} ${data.error || ""}`.trim());
    assert(data.ok === true, "mirror ok was not true");
    assert(data.truth_state?.status === "needs_checking", `expected needs_checking, got ${data.truth_state?.status || "missing"}`);
  });

  await check("source check returns cited evidence or a verification plan", async () => {
    const response = await fetchWithTimeout(`${GATEWAY}/v1/mirror/source-check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Active-Mirror-Session": `canary-${RUN_ID}`,
      },
      body: JSON.stringify({
        intent: "What are the latest GenUI competitors today, and who is winning?",
        question: "Which current sources define the GenUI competitor set?",
        move: "Check current sources before using this claim.",
        boundary: "personal",
      }),
    });
    const data = await response.json().catch(() => ({}));
    assert([200, 502].includes(response.status), `source-check status ${response.status} ${data.error || ""}`.trim());
    assert(data.error !== "source_check_error", "source check returned an internal gateway error");
    assert(["supported", "mixed", "not_enough"].includes(data.research?.verdict), "source verdict missing");
    assert(typeof data.research?.source_quality?.best_score === "number", "source quality summary missing");
    if (data.ok === true) {
      assert(data.truth_state?.status === "checked", `expected checked, got ${data.truth_state?.status || "missing"}`);
      assert(Array.isArray(data.research?.sources) && data.research.sources.length > 0, "sources missing");
      assert(/^https?:\/\//.test(data.research.sources[0].url || ""), "first source url missing");
      assert(typeof data.research.sources[0].quality === "string", "source quality missing");
      assert(typeof data.research.sources[0].quality_score === "number", "source quality score missing");
      const scores = data.research.sources.map((source) => Number(source.quality_score || 0));
      assert(scores.every((score, index) => index === 0 || score <= scores[index - 1]), "sources are not ranked by quality");
    } else {
      assert(data.truth_state?.status === "needs_checking", `expected needs_checking, got ${data.truth_state?.status || "missing"}`);
      assert(data.research?.verification_plan?.status === "needs_sources", "verification plan missing");
      assert(Array.isArray(data.research?.verification_plan?.queries) && data.research.verification_plan.queries.length > 0, "verification queries missing");
      assert(Array.isArray(data.research?.sources) && data.research.sources.length === 0, "unchecked result should not include sources");
    }
  });

  await check("enterprise proof stream emits public demo events", async () => {
    const response = await fetchWithTimeout(`${GATEWAY}/v1/mirror/enterprise-stream?run=ops`, {
      method: "GET",
      headers: {
        Origin: SITE,
        "X-Active-Mirror-Session": `canary-${RUN_ID}`,
      },
    });
    const text = await response.text();
    const payloads = text
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)));
    const events = payloads.filter((payload) => payload.type === "enterprise_proof_event");
    const done = payloads.find((payload) => payload.type === "enterprise_proof_done");

    assert(response.ok, `enterprise stream status ${response.status}`);
    assert(/text\/event-stream/.test(response.headers.get("content-type") || ""), "enterprise stream content type missing");
    assert(response.headers.get("x-active-mirror-event-policy") === "public-demo-only", "enterprise stream policy missing");
    assert(events.length === 5, `expected 5 stream events, got ${events.length}`);
    assert(done?.run?.id === "ops", "stream done event missing or wrong run");
    assert(text.includes(`canary-${RUN_ID}`) === false, "session leaked into stream");
  });

  await check("proof sprint request returns metadata-only receipt", async () => {
    const response = await fetchWithTimeout(`${GATEWAY}/v1/mirror/proof-sprint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: SITE,
        "X-Active-Mirror-Session": `canary-${RUN_ID}`,
      },
      body: JSON.stringify({
        reply_to: `canary-${RUN_ID}@example.com`,
        workflow: "research",
        timeline: "72h",
        source: "hero",
        consent: true,
        website: "",
      }),
    });
    const data = await response.json().catch(() => ({}));

    assert(response.status === 202, `proof sprint status ${response.status} ${data.error || ""}`.trim());
    assert(response.headers.get("x-active-mirror-event-policy") === "metadata-only-contact", "proof sprint policy header missing");
    assert(data.ok === true, "proof sprint ok was not true");
    assert(/^psr_[0-9a-f]{16}$/.test(String(data.request_id || "")), "proof sprint request id missing");
    assert(/^[0-9a-f]{24}$/.test(String(data.receipt_id || "")), "proof sprint receipt id missing");
    assert(data.policy === "metadata-only-contact", "proof sprint policy missing");
  });

  const failed = checks.filter((item) => item.status === "FAIL");
  for (const item of checks) {
    const detail = item.detail ? ` - ${item.detail}` : "";
    console.log(`${item.status} ${item.name}${detail}`);
  }

  if (failed.length) {
    console.error(`Active Mirror production canary failed: ${failed.length}/${checks.length}`);
    process.exit(1);
  }

  console.log(`Active Mirror production canary passed: ${checks.length}/${checks.length}`);
}

async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, status: "PASS" });
  } catch (error) {
    checks.push({ name, status: "FAIL", detail: error?.message || String(error) });
  }
}

async function readJson(url, init) {
  const response = await fetchWithTimeout(url, init);
  const data = await response.json().catch(() => ({}));
  assert(response.ok, `${url} status ${response.status}`);
  return data;
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timeout);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoForbiddenPublicCopy(text) {
  for (const term of FORBIDDEN_PUBLIC_COPY) {
    assert(!text.includes(term), `forbidden public copy leaked: ${term}`);
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});

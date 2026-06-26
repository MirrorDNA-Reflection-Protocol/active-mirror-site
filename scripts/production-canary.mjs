#!/usr/bin/env node

const SITE = process.env.ACTIVE_MIRROR_SITE || "https://activemirror.ai";
const GATEWAY = process.env.ACTIVE_MIRROR_GATEWAY || "https://gateway.activemirror.ai";
const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const TIMEOUT_MS = Number(process.env.ACTIVE_MIRROR_CANARY_TIMEOUT_MS || 18000);

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
    assert(text.includes("frame-ancestors 'none'"), "frame ancestor policy missing");
    assert(text.includes('referrer" content="strict-origin-when-cross-origin"'), "referrer policy missing");
    assert(!/serviceWorker\\.getRegistrations\\(\\)/.test(text), "inline service-worker cleanup still present");
  });

  await check("gateway health is current", async () => {
    const data = await readJson(`${GATEWAY}/health`);
    assert(data.ok === true, "health ok was not true");
    assert(String(data.version || "").startsWith("2026-06-26-"), "unexpected gateway version");
    assert(data.guardrails?.event_policy === "no-prompt-content", "event policy missing");
    assert(data.guardrails?.mirror_rate_limit === "enabled", "mirror rate limit not enabled");
    assert(data.guardrails?.event_rate_limit === "enabled", "event rate limit not enabled");
    assert(typeof data.guardrails?.daily_budget === "string", "daily budget status missing");
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

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});

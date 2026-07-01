#!/usr/bin/env node

const GATEWAY = process.env.ACTIVE_MIRROR_GATEWAY || "https://gateway.activemirror.ai";
const BRIDGE = process.env.ACTIVE_MIRROR_BRIDGE || "https://bridge.activemirror.ai";
const PROXY = process.env.ACTIVE_MIRROR_PROXY || "https://proxy.activemirror.ai";
const TIMEOUT_MS = Number(process.env.ACTIVE_MIRROR_MONITOR_TIMEOUT_MS || 30000);
const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const LOG_TYPES = new Set([
  "active_mirror_rate_limited",
  "active_mirror_provider_fallback",
  "active_mirror_source_check_fallback",
  "active_mirror_guardrail_degraded",
]);

const args = new Set(process.argv.slice(2));
const logsMode = args.has("--logs") || process.env.ACTIVE_MIRROR_MONITOR_LOGS === "1";
const bothMode = args.has("--both") || process.env.ACTIVE_MIRROR_MONITOR_BOTH === "1";

async function main() {
  const summary = {
    ok: true,
    gateway: GATEWAY,
    mode: bothMode ? "both" : logsMode ? "logs" : "probe",
    run_id: RUN_ID,
    checks: [],
    counts: {
      rate_limited: 0,
      provider_fallback: 0,
      source_check_fallback: 0,
      guardrail_degraded: 0,
      by_scope: {},
      by_capability: {},
      by_fallback: {},
    },
    alerts: [],
  };

  if (!logsMode || bothMode) {
    await runProbeChecks(summary);
  }

  if (logsMode || bothMode) {
    const input = await readStdin();
    ingestLogLines(summary, input);
    applyLogThresholds(summary);
  }

  summary.ok = summary.alerts.length === 0 && summary.checks.every((check) => check.status === "pass");

  if (!summary.ok) {
    await sendWebhook(summary).catch((error) => {
      summary.alerts.push({ type: "webhook_failed", detail: safeError(error) });
    });
  }

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.ok ? 0 : 1);
}

async function runProbeChecks(summary) {
  await check(summary, "gateway health exposes live guardrails", async () => {
    const data = await readJson(`${GATEWAY}/health`);
    assert(data.ok === true, "health ok was not true");
    assert(/^2026-07-01-council-control-plane-v1$/.test(String(data.version || "")), `unexpected version ${data.version || "missing"}`);
    assert(data.guardrails?.event_policy === "no-prompt-content", "event policy missing");
    assert(data.guardrails?.truth_state === "enabled", "truth-state guardrail missing");
    assert(data.guardrails?.source_check === "enabled", "source-check guardrail missing");
    assert(data.guardrails?.council_control_plane === "active_mirror_council_control_plane_v1", "council control plane missing");
    assert(data.guardrails?.council_route === "intent_router_to_council_to_receipt_to_promotion_gate", "council route missing");
    assert(data.guardrails?.council_count === "8", "council count missing");
    assert(data.guardrails?.mirror_rate_limit === "enabled", "mirror rate limit missing");
    assert(data.guardrails?.event_rate_limit === "enabled", "event rate limit missing");
    assert(data.guardrails?.daily_budget === "enabled", "daily budget missing");
    assert(Number(data.guardrails?.daily_session_limit || 0) > 0, "daily session limit missing");
    assert(Number(data.guardrails?.daily_network_limit || 0) > 0, "daily network limit missing");
    return { version: data.version };
  });

  await check(summary, "bridge health is reachable", async () => {
    const data = await readJson(`${BRIDGE}/health`);
    assert(data.ok === true, "bridge health ok was not true");
    return { host: new URL(BRIDGE).hostname };
  });

  await check(summary, "proxy health is reachable", async () => {
    const data = await readJson(`${PROXY}/health`);
    assert(data.ok === true, "proxy health ok was not true");
    return { host: new URL(PROXY).hostname };
  });

  await check(summary, "mirror route returns a non-fallback turn", async () => {
    const response = await fetchWithTimeout(`${GATEWAY}/v1/mirror/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Active-Mirror-Session": `monitor-${RUN_ID}`,
      },
      body: JSON.stringify({
        intent: "I need one small next move for a stuck project without saving private context.",
        boundary: "personal",
        route: "reflection",
        turn: 1,
      }),
    });
    const data = await response.json().catch(() => ({}));
    assert(response.ok, `mirror status ${response.status} ${data.error || ""}`.trim());
    assert(data.ok === true, "mirror ok was not true");
    assert(data.fallback === false, `mirror used fallback ${data.route?.fallback || "unknown"}`);
    assert(data.route?.primary === "bridge", `mirror primary was ${data.route?.primary || "missing"}`);
    assert(data.route?.provider === "bridge", `mirror provider was ${data.route?.provider || "missing"}`);
    assert(data.route?.upstream_host === new URL(BRIDGE).hostname, `mirror upstream host was ${data.route?.upstream_host || "missing"}`);
    assert(/^[a-f0-9]{24}$/.test(String(data.receipt_id || "")), "receipt id missing");
    assert(typeof data.mirror?.move === "string" && data.mirror.move.length > 8, "move missing");
    return { receipt_id: data.receipt_id, truth_state: data.truth_state?.status || "unknown", provider: data.route?.provider };
  });

  await check(summary, "chat route returns a non-fallback turn", async () => {
    const response = await fetchWithTimeout(`${GATEWAY}/v1/mirror/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Active-Mirror-Session": `monitor-chat-${RUN_ID}`,
      },
      body: JSON.stringify({
        intent: "Rewrite this into one honest, calm sentence: I need a next move, not another plan.",
        boundary: "personal",
        route: "chat",
        turn: 1,
      }),
    });
    const data = await response.json().catch(() => ({}));
    assert(response.ok, `chat status ${response.status} ${data.error || ""}`.trim());
    assert(data.ok === true, "chat ok was not true");
    assert(data.fallback === false, `chat used fallback ${data.route?.fallback || "unknown"}`);
    assert(data.route?.capability === "chat", `chat capability was ${data.route?.capability || "missing"}`);
    assert(data.route?.primary === "bridge", `chat primary was ${data.route?.primary || "missing"}`);
    assert(data.route?.provider === "bridge", `chat provider was ${data.route?.provider || "missing"}`);
    assert(data.route?.upstream_host === new URL(BRIDGE).hostname, `chat upstream host was ${data.route?.upstream_host || "missing"}`);
    assert(typeof data.mirror?.move === "string" && data.mirror.move.length > 8, "move missing");
    return { receipt_id: data.receipt_id, provider: data.route?.provider };
  });

  await check(summary, "oversized payload is rejected before provider call", async () => {
    const response = await fetchWithTimeout(`${GATEWAY}/v1/mirror/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Active-Mirror-Session": `monitor-big-${RUN_ID}`,
      },
      body: JSON.stringify({
        intent: "x".repeat(20000),
        boundary: "personal",
        route: "reflection",
        turn: 1,
      }),
    });
    const data = await response.json().catch(() => ({}));
    assert(response.status === 413, `expected 413, got ${response.status}`);
    assert(data.error === "payload_too_large", `unexpected payload error ${data.error || "missing"}`);
    return { status: response.status, error: data.error };
  });
}

async function check(summary, name, fn) {
  try {
    const detail = await fn();
    summary.checks.push({ name, status: "pass", detail });
  } catch (error) {
    const detail = safeError(error);
    summary.checks.push({ name, status: "fail", detail });
    summary.alerts.push({ type: "probe_failed", check: name, detail });
  }
}

function ingestLogLines(summary, input) {
  for (const line of input.split(/\r?\n/)) {
    if (!line.trim()) continue;
    for (const payload of extractPayloads(line)) {
      if (!LOG_TYPES.has(payload.type)) continue;
      recordPayload(summary, payload);
    }
  }
}

function recordPayload(summary, payload) {
  if (payload.type === "active_mirror_rate_limited") {
    summary.counts.rate_limited += 1;
    increment(summary.counts.by_scope, payload.scope || "unknown");
  } else if (payload.type === "active_mirror_provider_fallback") {
    summary.counts.provider_fallback += 1;
    increment(summary.counts.by_capability, payload.capability || "unknown");
    increment(summary.counts.by_fallback, payload.fallback || "unknown");
  } else if (payload.type === "active_mirror_source_check_fallback") {
    summary.counts.source_check_fallback += 1;
    increment(summary.counts.by_fallback, payload.fallback || payload.reason || "source_check");
  } else if (payload.type === "active_mirror_guardrail_degraded") {
    summary.counts.guardrail_degraded += 1;
  }
}

function applyLogThresholds(summary) {
  const rateLimitThreshold = positiveInt(process.env.ACTIVE_MIRROR_RATE_LIMIT_ALERT_COUNT, 5);
  const fallbackThreshold = positiveInt(process.env.ACTIVE_MIRROR_FALLBACK_ALERT_COUNT, 2);
  const degradedThreshold = positiveInt(process.env.ACTIVE_MIRROR_DEGRADED_ALERT_COUNT, 1);
  const fallbackTotal = summary.counts.provider_fallback + summary.counts.source_check_fallback;

  if (summary.counts.rate_limited >= rateLimitThreshold) {
    summary.alerts.push({
      type: "rate_limit_spike",
      count: summary.counts.rate_limited,
      threshold: rateLimitThreshold,
      by_scope: summary.counts.by_scope,
    });
  }

  if (fallbackTotal >= fallbackThreshold) {
    summary.alerts.push({
      type: "fallback_spike",
      count: fallbackTotal,
      threshold: fallbackThreshold,
      by_capability: summary.counts.by_capability,
      by_fallback: summary.counts.by_fallback,
    });
  }

  if (summary.counts.guardrail_degraded >= degradedThreshold) {
    summary.alerts.push({
      type: "guardrail_degraded",
      count: summary.counts.guardrail_degraded,
      threshold: degradedThreshold,
    });
  }
}

function extractPayloads(line) {
  const payloads = [];
  const parsed = parseJsonMaybe(line);
  if (parsed) collectPayloads(parsed, payloads);

  if (!payloads.length) {
    const start = line.indexOf("{");
    const end = line.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const embedded = parseJsonMaybe(line.slice(start, end + 1));
      if (embedded) collectPayloads(embedded, payloads);
    }
  }

  return payloads;
}

function collectPayloads(value, payloads) {
  if (!value || typeof value !== "object") return;
  if (typeof value.type === "string" && value.type.startsWith("active_mirror_")) {
    payloads.push(value);
  }

  if (Array.isArray(value.logs)) {
    for (const entry of value.logs) {
      if (typeof entry === "string") {
        const parsed = parseJsonMaybe(entry);
        if (parsed) collectPayloads(parsed, payloads);
      } else if (entry && typeof entry === "object") {
        collectPayloads(entry, payloads);
        const message = entry.message || entry.Message;
        if (typeof message === "string") {
          const parsed = parseJsonMaybe(message);
          if (parsed) collectPayloads(parsed, payloads);
        }
      }
    }
  }

  if (typeof value.message === "string") {
    const parsed = parseJsonMaybe(value.message);
    if (parsed) collectPayloads(parsed, payloads);
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

async function sendWebhook(summary) {
  const webhook = process.env.ACTIVE_MIRROR_ALERT_WEBHOOK;
  if (!webhook) return;
  await fetchWithTimeout(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(summary),
  });
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => resolve(input));
    process.stdin.on("error", reject);
  });
}

function parseJsonMaybe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function increment(target, key) {
  target[key] = (target[key] || 0) + 1;
}

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safeError(error) {
  return String(error?.message || error || "unknown").replace(/\s+/g, " ").slice(0, 240);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});

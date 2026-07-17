#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const MONITOR = fileURLToPath(new URL("./gateway-monitor.mjs", import.meta.url));
const tempRoot = await mkdtemp(join(tmpdir(), "active-mirror-gateway-monitor-"));
const configPath = join(tempRoot, "wrangler.jsonc");

await writeFile(configPath, JSON.stringify({
  vars: {
    MIRROR_REFLECTION_PRIMARY: "openai",
    MIRROR_CHAT_PRIMARY: "openai",
  },
}), "utf8");

try {
  await check("configured routes and empty chat move pass", async () => {
    const fixture = await startFixture("openai");
    try {
      const result = await runMonitor(fixture.url);
      assert.equal(result.code, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.ok, true);
      assert.equal(summary.route_expectations.reflection.source, configPath);
      assert.equal(summary.route_expectations.chat.source, configPath);
      assert.equal(summary.route_expectations.reflection.primary, "openai");
      assert.equal(summary.route_expectations.chat.primary, "openai");
      assert.equal(summary.checks.find((item) => item.name.startsWith("chat route"))?.status, "pass");
    } finally {
      await fixture.close();
    }
  });

  await check("configured/live route mismatch fails", async () => {
    const fixture = await startFixture("bridge");
    try {
      const result = await runMonitor(fixture.url);
      assert.equal(result.code, 1, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.ok, false);
      assert.match(
        summary.checks.find((item) => item.name.startsWith("mirror route"))?.detail || "",
        /mirror primary was bridge/,
      );
    } finally {
      await fixture.close();
    }
  });
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function startFixture(primary) {
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      return json(response, 200, gatewayHealth());
    }

    if (request.method === "POST" && request.url === "/v1/mirror/create") {
      const body = await readJson(request);
      if (String(body.intent || "").length >= 20000) {
        return json(response, 413, { ok: false, error: "payload_too_large" });
      }

      const chat = body.route === "chat";
      return json(response, 200, {
        ok: true,
        fallback: false,
        receipt_id: chat ? "b".repeat(24) : "a".repeat(24),
        response_mode: chat ? "conversation" : "reflection",
        mirror: {
          reflection: chat
            ? "I need one clear next move, not another plan."
            : "The project needs one visible output before another planning pass.",
          question: chat ? "" : "What is the next visible output?",
          move: chat ? "" : "Write the next visible output in one sentence.",
          receipt: { why: "fixture" },
        },
        route: {
          capability: chat ? "chat" : "reflection",
          primary,
          provider: primary,
          upstream_host: primary === "bridge" ? "bridge.activemirror.ai" : null,
        },
      });
    }

    return json(response, 404, { ok: false, error: "not_found" });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

function runMonitor(gateway) {
  const env = {
    ...process.env,
    ACTIVE_MIRROR_GATEWAY: gateway,
    ACTIVE_MIRROR_EXPECTED_GATEWAY_VERSION: "test-version",
    ACTIVE_MIRROR_MONITOR_TIMEOUT_MS: "2000",
    ACTIVE_MIRROR_REQUIRE_BRIDGE_HEALTH: "0",
    ACTIVE_MIRROR_WORKER_CONFIG: configPath,
  };
  delete env.ACTIVE_MIRROR_EXPECTED_REFLECTION_PRIMARY;
  delete env.ACTIVE_MIRROR_EXPECTED_REFLECTION_PROVIDER;
  delete env.ACTIVE_MIRROR_EXPECTED_REFLECTION_UPSTREAM_HOST;
  delete env.ACTIVE_MIRROR_EXPECTED_CHAT_PRIMARY;
  delete env.ACTIVE_MIRROR_EXPECTED_CHAT_PROVIDER;
  delete env.ACTIVE_MIRROR_EXPECTED_CHAT_UPSTREAM_HOST;

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [MONITOR], { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function gatewayHealth() {
  const enabled = "enabled";
  return {
    ok: true,
    version: "test-version",
    guardrails: {
      event_policy: "no-prompt-content",
      truth_state: enabled,
      volunteer_bad_news: enabled,
      source_backed_or_labeled: enabled,
      no_conflating: enabled,
      model_proposes_runtime_validates: enabled,
      user_is_authority: enabled,
      prompt_plus_gates: enabled,
      trust_by_design: enabled,
      anti_sycophancy: enabled,
      no_sycophancy: enabled,
      zero_sycophancy: enabled,
      no_flattery: enabled,
      no_agree_to_please: enabled,
      no_confidence_inflation: enabled,
      challenge_with_evidence: enabled,
      kind_directness: enabled,
      source_check: enabled,
      council_control_plane: "active_mirror_council_control_plane_v1",
      council_route: "intent_router_to_council_to_receipt_to_promotion_gate",
      council_count: "8",
      mirror_rate_limit: enabled,
      event_rate_limit: enabled,
      daily_budget: enabled,
      image_budget: enabled,
      media_storage: "fixture",
      media_url_policy: "fixture",
      daily_session_limit: "1",
      daily_network_limit: "1",
    },
  };
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error?.stack || error}`);
    process.exitCode = 1;
  }
}

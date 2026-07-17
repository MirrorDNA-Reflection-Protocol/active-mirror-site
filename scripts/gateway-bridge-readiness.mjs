#!/usr/bin/env node
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const MINI_IP = process.env.ACTIVE_MIRROR_MINI_TAILSCALE_IP || "100.114.247.53";
const MINI_SSH = process.env.ACTIVE_MIRROR_MINI_SSH || "mini";
const BRIDGE = process.env.ACTIVE_MIRROR_BRIDGE || "https://bridge.activemirror.ai";
const TIMEOUT_MS = Number(process.env.ACTIVE_MIRROR_BRIDGE_READY_TIMEOUT_MS || 12000);
const SCHEMA_VERSION = "active_mirror.bridge_readiness.v2";

async function main() {
  const checks = [];

  await record(checks, "mini tailscale ping", async () => {
    await run("tailscale", ["ping", "--timeout=5s", "--c=1", MINI_IP], TIMEOUT_MS);
    return { target: MINI_IP };
  }, { required: false });

  await record(checks, "mini ssh", async () => {
    const result = await run("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", MINI_SSH, "hostname"], TIMEOUT_MS);
    return { target: MINI_SSH, host: result.stdout.trim() };
  });

  await record(checks, "mini bridge origin", async () => {
    const result = await run(
      "ssh",
      [
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=8",
        MINI_SSH,
        "/usr/bin/curl -sSf --max-time 5 http://127.0.0.1:8082/health",
      ],
      TIMEOUT_MS
    );
    return validateHealthPayload(JSON.parse(result.stdout), "active-mirror-mini-bridge", "mini loopback");
  });

  await record(checks, "mini bridge tunnel metrics", async () => {
    await run(
      "ssh",
      [
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=8",
        MINI_SSH,
        "/usr/bin/curl -sSf --max-time 5 http://127.0.0.1:20262/metrics >/dev/null",
      ],
      TIMEOUT_MS
    );
    return { target: MINI_SSH, service: "ai.activemirror.active-mirror-bridge" };
  });

  await record(checks, "public bridge health", async () => readHealth(BRIDGE, "active-mirror-mini-bridge"));

  const ok = checks.every((check) => check.status !== "fail");
  const warnings = checks.filter((check) => check.status === "warn");
  const summary = {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    ok,
    status: ok ? "PASS" : "FAIL",
    mode: "bridge-readiness",
    boundary: "mini_origin_tunnel_public_bridge",
    mini_ip: MINI_IP,
    mini_ssh: MINI_SSH,
    bridge: BRIDGE,
    checks,
    warnings,
    bad_news: warnings.map((warning) => `${warning.name}: ${safeError(warning.detail)}`),
    next: ok ? "bridge activation proof is complete" : "repair the first failed check, then rerun npm run bridge:ready",
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(ok ? 0 : 1);
}

async function record(checks, name, fn, { required = true } = {}) {
  try {
    const detail = await fn();
    checks.push({ name, status: "pass", detail });
  } catch (error) {
    checks.push({ name, status: required ? "fail" : "warn", detail: safeError(error) });
  }
}

async function readHealth(url, expectedService) {
  const response = await fetchWithTimeout(`${url.replace(/\/$/, "")}/health`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${url}/health status ${response.status}`);
  return { url, ...validateHealthPayload(data, expectedService, `${url}/health`) };
}

export function validateHealthPayload(data, expectedService, source) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${source} payload was not an object`);
  }
  if (data.ok !== true) throw new Error(`${source} ok was not true`);
  if (data.service !== expectedService) {
    throw new Error(`${source} service was ${String(data.service || "missing")}`);
  }
  return { ok: true, service: data.service };
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timeout);
  }
}

function run(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} timed out`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code, signal) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} exited ${code ?? signal}: ${stderr || stdout}`));
      }
    });
  });
}

export function safeError(error) {
  return String(error?.message || error || "unknown").replace(/\s+/g, " ").slice(0, 240);
}

const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entryUrl) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exit(1);
  });
}

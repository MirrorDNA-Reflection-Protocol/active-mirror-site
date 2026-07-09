#!/usr/bin/env node
import { spawn } from "node:child_process";

const MINI_IP = process.env.ACTIVE_MIRROR_MINI_TAILSCALE_IP || "100.114.247.53";
const MINI_SSH = process.env.ACTIVE_MIRROR_MINI_SSH || "mirror-admin@mirror-admins-mac-mini";
const BRIDGE = process.env.ACTIVE_MIRROR_BRIDGE || "https://bridge.activemirror.ai";
const PROXY = process.env.ACTIVE_MIRROR_PROXY || "https://proxy.activemirror.ai";
const TIMEOUT_MS = Number(process.env.ACTIVE_MIRROR_BRIDGE_READY_TIMEOUT_MS || 12000);

async function main() {
  const checks = [];

  await record(checks, "mini tailscale ping", async () => {
    await run("tailscale", ["ping", "--timeout=5s", "--c=1", MINI_IP], TIMEOUT_MS);
    return { target: MINI_IP };
  });

  await record(checks, "mini ssh", async () => {
    const result = await run("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", MINI_SSH, "hostname"], TIMEOUT_MS);
    return { target: MINI_SSH, host: result.stdout.trim() };
  });

  await record(checks, "mini bridge tunnel service", async () => {
    await run(
      "ssh",
      [
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=8",
        MINI_SSH,
        "curl -sf --max-time 5 http://127.0.0.1:20262/metrics >/dev/null && curl -sf --max-time 5 https://bridge.activemirror.ai/health >/dev/null",
      ],
      TIMEOUT_MS
    );
    return { target: MINI_SSH, service: "ai.activemirror.active-mirror-bridge" };
  });

  await record(checks, "public bridge health", async () => readHealth(BRIDGE));
  await record(checks, "public proxy health", async () => readHealth(PROXY));

  const ok = checks.every((check) => check.status === "pass");
  const summary = {
    ok,
    mode: "bridge-readiness",
    mini_ip: MINI_IP,
    mini_ssh: MINI_SSH,
    bridge: BRIDGE,
    proxy: PROXY,
    checks,
    next: ok ? "run npm run bridge:restore" : "turn on or reconnect the Mini, then rerun npm run bridge:ready",
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(ok ? 0 : 1);
}

async function record(checks, name, fn) {
  try {
    const detail = await fn();
    checks.push({ name, status: "pass", detail });
  } catch (error) {
    checks.push({ name, status: "fail", detail: safeError(error) });
  }
}

async function readHealth(url) {
  const response = await fetchWithTimeout(`${url.replace(/\/$/, "")}/health`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${url}/health status ${response.status}`);
  if (data.ok !== true) throw new Error(`${url}/health ok was not true`);
  return { url, ok: data.ok, service: data.service || data.name || "unknown" };
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

function safeError(error) {
  return String(error?.message || error || "unknown").replace(/\s+/g, " ").slice(0, 240);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});

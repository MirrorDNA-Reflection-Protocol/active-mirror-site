#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TARGET_VERSION =
  process.env.ACTIVE_MIRROR_BRIDGE_RESTORE_VERSION || "2026-07-09-bridge-primary-restored-v1";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skipDeploy = process.argv.includes("--no-deploy");

  await step("prove Mini bridge readiness", "node", ["scripts/gateway-bridge-readiness.mjs"]);
  await updateFiles({ dryRun });

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dry_run: true, next: "run npm run bridge:restore" }, null, 2));
    return;
  }

  await step("worker tests", "npm", ["run", "worker:test"]);

  if (!skipDeploy) {
    await step("deploy Worker", "npm", ["run", "worker:deploy"]);
  }

  await step("default bridge-primary monitor", "npm", ["run", "monitor:gateway"]);
  await step("production canary", "npm", ["run", "canary:prod"]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        version: TARGET_VERSION,
        route_policy: "bridge-primary",
        deployed: !skipDeploy,
        next: "commit worker/wrangler.jsonc, worker/src/index.js, monitor/canary version updates, and a rollback receipt",
      },
      null,
      2
    )
  );
}

async function updateFiles({ dryRun }) {
  const changes = [
    {
      file: "worker/wrangler.jsonc",
      replacements: [
        ['"MIRROR_REFLECTION_PRIMARY": "openai"', '"MIRROR_REFLECTION_PRIMARY": "bridge"'],
        ['"MIRROR_CHAT_PRIMARY": "openai"', '"MIRROR_CHAT_PRIMARY": "bridge"'],
      ],
    },
    {
      file: "worker/src/index.js",
      replacements: [[/const WORKER_VERSION = "[^"]+";/, `const WORKER_VERSION = "${TARGET_VERSION}";`]],
    },
    {
      file: "scripts/gateway-monitor.mjs",
      replacements: [[/ACTIVE_MIRROR_EXPECTED_GATEWAY_VERSION \|\| "[^"]+"/, `ACTIVE_MIRROR_EXPECTED_GATEWAY_VERSION || "${TARGET_VERSION}"`]],
    },
    {
      file: "scripts/production-canary.mjs",
      replacements: [[/ACTIVE_MIRROR_EXPECTED_GATEWAY_VERSION \|\| "[^"]+"/, `ACTIVE_MIRROR_EXPECTED_GATEWAY_VERSION || "${TARGET_VERSION}"`]],
    },
  ];

  const touched = [];
  for (const change of changes) {
    const absolute = path.join(ROOT, change.file);
    let text = await readFile(absolute, "utf8");
    const original = text;
    for (const [from, to] of change.replacements) {
      text = text.replace(from, to);
    }
    if (text !== original) {
      touched.push(change.file);
      if (!dryRun) await writeFile(absolute, text);
    }
  }

  if (dryRun) {
    console.log(JSON.stringify({ planned_files: touched, version: TARGET_VERSION }, null, 2));
  }
}

function step(label, command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n== ${label} ==`);
    const child = spawn(command, args, { cwd: ROOT, stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with ${code ?? signal}`));
    });
  });
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});

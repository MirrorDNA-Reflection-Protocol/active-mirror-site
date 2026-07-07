#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";

const ACCOUNT_ID = "c67a8591dff0a1b3681da50540530fc3";
const KEYCHAIN_SERVICE = "active-mirror-cloudflare-api-token";
const KEYCHAIN_ACCOUNT = "codex";
const BLOCKED_ENV_KEYS = [
  "CLOUDFLARE_API_TOKEN",
  "CF_API_TOKEN",
  "CLOUDFLARE_EMAIL",
  "CLOUDFLARE_API_KEY",
];

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    "Usage: node scripts/cloudflare-wrangler.mjs <wrangler args...>\n" +
      "Example: node scripts/cloudflare-wrangler.mjs whoami"
  );
  process.exit(64);
}

const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID };
for (const key of BLOCKED_ENV_KEYS) {
  delete env[key];
}

if (process.env.ACTIVE_MIRROR_CF_KEYCHAIN === "1") {
  const secret = spawnSync(
    "security",
    ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_ACCOUNT, "-w"],
    { encoding: "utf8" }
  );
  if (secret.status !== 0) {
    console.error(
      `Missing Keychain token ${KEYCHAIN_SERVICE}/${KEYCHAIN_ACCOUNT}. ` +
        "Either install it or omit ACTIVE_MIRROR_CF_KEYCHAIN=1 to use Wrangler OAuth."
    );
    process.exit(78);
  }
  env.CLOUDFLARE_API_TOKEN = secret.stdout.trim();
}

const child = spawn("npx", ["wrangler", ...args], {
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`wrangler terminated by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

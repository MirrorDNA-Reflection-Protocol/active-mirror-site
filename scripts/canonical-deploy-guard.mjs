import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const failures = [];
const warnings = [];

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function requireFile(path, label = path) {
  if (!existsSync(path)) failures.push(`Missing ${label}`);
}

const cname = read("public/CNAME").trim();
if (cname !== "activemirror.ai") {
  failures.push(`Deploy repo public/CNAME must be activemirror.ai, got "${cname || "(missing)"}"`);
}

const deployWorkflow = read(".github/workflows/deploy-pages.yml");
const legacyCnamePublish = /\bcname:\s*activemirror\.ai\b/.test(deployWorkflow);
const workflowPagesPublish =
  /actions\/upload-pages-artifact@/.test(deployWorkflow) &&
  /actions\/deploy-pages@/.test(deployWorkflow);
if (!legacyCnamePublish && !workflowPagesPublish) {
  failures.push("Deploy workflow must publish with cname: activemirror.ai or official Pages artifact deployment.");
}

requireFile(join("public/app", "index.html"), "/app/index.html shell");
requireFile(join("public/app", "404.html"), "/app/404.html shell fallback");
requireFile(join("public/app", "service-worker.js"), "/app/service-worker.js offline shell worker");

const appIndex = read(join("public/app", "index.html"));
const appFallback = read(join("public/app", "404.html"));
const appFallbackGenerator = read("scripts/app-fallbacks.mjs");
const appServiceWorker = read(join("public/app", "service-worker.js"));
const siteWorker = read("site-worker/index.js");
if (appIndex && appFallback && appIndex !== appFallback) {
  failures.push("/app/index.html and /app/404.html must match so deep links render the same app shell");
}
if (!appFallback.includes("/app/assets/")) {
  failures.push("/app/404.html must load app assets from /app/assets/");
}
if (!appServiceWorker.includes("active-mirror-app-shell-") || !appServiceWorker.includes("request.mode === 'navigate'")) {
  failures.push("/app/service-worker.js must be the generated bounded offline shell worker");
}
if (!siteWorker.includes('pathname === "/app/service-worker.js"') || !siteWorker.includes("return false")) {
  failures.push("Site Worker must serve /app/service-worker.js as an asset, not the HTML shell");
}
for (const route of ["id", "mirrorseed", "enterprise"]) {
  if (!appFallbackGenerator.includes(`'${route}'`)) {
    failures.push(`App fallback generator must include /app/${route}/`);
  }
}

const rootIndex = read("index.html");
if (!rootIndex.includes("id.activemirror.ai") || !rootIndex.includes("/app/start/")) {
  failures.push("Root redirect must route id.activemirror.ai into /app/start/");
}

const canonicalDoc = read("CANONICAL_SITE.md");
for (const required of [
  "/Users/mirror-pro/repos/activemirror-journey",
  "/Users/mirror-pro/repos/active-mirror-site/public/app",
  "https://activemirror.ai/app/start/",
  "https://id.activemirror.ai/",
]) {
  if (!canonicalDoc.includes(required)) {
    failures.push(`CANONICAL_SITE.md missing canonical deploy split entry: ${required}`);
  }
}

const worker = read("worker/src/index.js");
const productionCanary = read("scripts/production-canary.mjs");
const gatewayMonitor = read("scripts/gateway-monitor.mjs");
if (!worker.includes('"https://id.activemirror.ai"')) {
  failures.push("Worker allowed origins must include https://id.activemirror.ai");
}
if (!worker.includes("/v1/mirror/proof-sprint")) {
  failures.push("Worker must expose the proof-sprint metadata endpoint.");
}
const workerVersion = worker.match(/const WORKER_VERSION = "([^"]+)";/)?.[1] || "";
if (!workerVersion) {
  failures.push("Worker must declare a versioned runtime identifier.");
} else {
  for (const [label, source] of [["production canary", productionCanary], ["gateway monitor", gatewayMonitor]]) {
    if (!source.includes(`ACTIVE_MIRROR_EXPECTED_GATEWAY_VERSION || "${workerVersion}"`)) {
      failures.push(`${label} expected version must match Worker version ${workerVersion}.`);
    }
  }
}

const kernel = read("worker/KERNEL.md");
if (!kernel.includes("POST /v1/mirror/proof-sprint") || !kernel.includes("https://id.activemirror.ai")) {
  failures.push("worker/KERNEL.md must document proof-sprint and id.activemirror.ai.");
}

const sourceRepo = resolve(process.env.ACTIVE_MIRROR_SOURCE_REPO || "/Users/mirror-pro/repos/activemirror-journey");
if (existsSync(sourceRepo)) {
  if (existsSync(join(sourceRepo, "CNAME"))) {
    failures.push(`${sourceRepo} must not contain CNAME; only this deploy repo should claim activemirror.ai.`);
  }
} else {
  warnings.push(`Source repo not present, skipped sibling CNAME check: ${sourceRepo}`);
}

if (warnings.length) {
  for (const warning of warnings) console.warn(`Canonical deploy guard warning: ${warning}`);
}

if (failures.length) {
  console.error("Canonical deploy guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Canonical deploy guard passed.");

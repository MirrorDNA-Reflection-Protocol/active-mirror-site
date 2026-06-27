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
if (!/\bcname:\s*activemirror\.ai\b/.test(deployWorkflow)) {
  failures.push("Deploy workflow must publish with cname: activemirror.ai");
}

for (const route of ["brainscan", "id", "mirrorseed", "scan", "start", "mirror", "enterprise", "privacy", "terms"]) {
  requireFile(join("public/app", route, "index.html"), `/app/${route}/ fallback`);
}

const rootIndex = read("index.html");
if (!rootIndex.includes("id.activemirror.ai") || !rootIndex.includes("/app/start/index.html")) {
  failures.push("Root redirect must route id.activemirror.ai into /app/start/index.html");
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
if (!worker.includes('"https://id.activemirror.ai"')) {
  failures.push("Worker allowed origins must include https://id.activemirror.ai");
}
if (!worker.includes("/v1/mirror/proof-sprint")) {
  failures.push("Worker must expose the proof-sprint metadata endpoint.");
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

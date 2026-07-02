import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  if (!process.argv[index]?.startsWith("--")) continue;
  args.set(process.argv[index].slice(2), process.argv[index + 1]);
}

const outputDir = resolve(args.get("output") || process.env.AMOS_COPY_SWEEP_OUTPUT_DIR || "/tmp/active-mirror-site/amos-public-copy-friction");

const sourceFiles = [
  "index.html",
  "mirror/index.html",
  "product/index.html",
  "trust/index.html",
  "pricing/index.html",
  "privacy/index.html",
  "terms/index.html",
  "src/main.js",
];

const forbiddenClientMarkers = [
  /\bSWFI\b/i,
  /Sovereign Wealth Fund Institute/i,
  /\bDipika\b/i,
  /sovereign-fund space/i,
  /\bBlackRock\b/i,
  /\bADIA\b/i,
  /\bGIC\b/i,
  /\bPIF\b/i,
];

const frictionPatterns = [
  { label: "internal_language", regex: /\b(viewport|widget|protocol|runtime|gateway|provider|adapter|sovereign)\b/i },
  { label: "sensitive_scope_language", regex: /client-confidential/i },
  { label: "paternal_language", regex: /need to hear|want to hear|honest next move/i },
  { label: "diagnostic_language", regex: /\bADHD\b|neurodivergent|neuroD/i },
  { label: "setup_language", regex: /Getting honest pushback|How should I push back|Push back/i },
];

function canonicalString(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalString(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalString(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return createHash("sha256").update(typeof value === "string" ? value : canonicalString(value)).digest("hex").slice(0, 24);
}

function visibleText(text, file) {
  if (!file.endsWith(".html")) return text;
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&rarr;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function lineForMatch(text, matchIndex) {
  return text.slice(0, matchIndex).split("\n").length;
}

function scanFile(file) {
  const absolute = resolve(repoRoot, file);
  const raw = readFileSync(absolute, "utf8");
  const text = visibleText(raw, file);
  const findings = [];

  if (file.endsWith(".html")) {
    for (const pattern of frictionPatterns) {
      const match = text.match(pattern.regex);
      if (match?.index !== undefined) {
        findings.push({
          file,
          label: pattern.label,
          match: match[0],
          line: null,
          severity: "review",
        });
      }
    }
  }

  for (const pattern of forbiddenClientMarkers) {
    const match = text.match(pattern);
    if (match?.index !== undefined) {
      findings.push({
        file,
        label: "client_boundary_marker",
        match: match[0],
        line: file.endsWith(".html") ? null : lineForMatch(raw, match.index),
        severity: "block",
      });
    }
  }

  return {
    file,
    sha256: createHash("sha256").update(raw).digest("hex"),
    characters_checked: text.length,
    findings,
  };
}

mkdirSync(outputDir, { recursive: true });

const copyAudit = spawnSync(process.execPath, [resolve(repoRoot, "scripts/public-copy-audit.mjs")], {
  cwd: repoRoot,
  encoding: "utf8",
});

const fileReports = sourceFiles.map(scanFile);
const findings = fileReports.flatMap((report) => report.findings);
const blockers = findings.filter((finding) => finding.severity === "block");
const status = copyAudit.status === 0 && blockers.length === 0 ? "ready_for_review" : "blocked";

const report = {
  schema_version: "amos-public-copy-friction-sweep/v0.1",
  sweep_id: `copy_sweep_${hash({ sourceFiles, fileReports, copyAudit: copyAudit.status })}`,
  workflow_id: "public-copy-friction-sweep",
  status,
  checked_at: "2026-07-02T00:00:00.000Z",
  files_checked: fileReports.map(({ file, sha256, characters_checked }) => ({ file, sha256, characters_checked })),
  checks: [
    {
      id: "public_copy_audit",
      status: copyAudit.status === 0 ? "passed" : "failed",
      stdout: copyAudit.stdout.trim(),
      stderr: copyAudit.stderr.trim(),
    },
    {
      id: "client_boundary_markers",
      status: blockers.length === 0 ? "passed" : "failed",
      blocker_count: blockers.length,
    },
    {
      id: "external_actions",
      status: "passed",
      external_actions_executed: [],
    },
  ],
  findings,
  review_packet: {
    title: "Public copy friction sweep",
    summary:
      status === "ready_for_review"
        ? "The current public copy passed the hard audit. Review findings are suggestions only."
        : "The current public copy has blockers that should not ship until resolved.",
    suggested_next_move:
      findings.length === 0
        ? "Keep the first action singular and test the live page on phone before changing copy."
        : "Review each finding and replace formal or internal wording with calmer user-facing language before promotion.",
  },
  external_actions_executed: [],
  memory_promoted: [],
  risks_remaining: [
    "This sweep reads local source files only; it does not prove user comprehension.",
    "It does not deploy, edit copy, or replace live mobile QA.",
  ],
};

writeFileSync(resolve(outputDir, "public-copy-friction-report.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(
  resolve(outputDir, "public-copy-friction-report.md"),
  [
    "# Public Copy Friction Sweep",
    "",
    `Status: \`${report.status}\``,
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.id}: ${check.status}`),
    "",
    "## Findings",
    "",
    ...(report.findings.length
      ? report.findings.map((finding) => `- ${finding.file}: ${finding.label} -> "${finding.match}"`)
      : ["- None."]),
    "",
    "## Risks Remaining",
    "",
    ...report.risks_remaining.map((risk) => `- ${risk}`),
    "",
  ].join("\n"),
);

console.log(JSON.stringify(report, null, 2));

if (status !== "ready_for_review") process.exit(1);

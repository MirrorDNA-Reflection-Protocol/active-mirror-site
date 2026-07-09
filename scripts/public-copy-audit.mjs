import { readFileSync } from "node:fs";

const htmlFiles = [
  "index.html",
  "consulting/index.html",
  "enterprise/index.html",
  "mirror/index.html",
  "product/index.html",
  "trust/index.html",
  "pricing/index.html",
  "privacy/index.html",
  "terms/index.html",
  "public/mirrorprod-india/index.html",
  "public/mirrorprod/index.html",
];

const runtimeFiles = ["src/main.js"];

const patterns = [
  { label: "build-stage versioning", regex: /\bv0(?:\.\d+)?\b/i },
  { label: "narrow/internal scope", regex: /intentionally narrow/i },
  { label: "internal viewport language", regex: /\bviewport\b/i },
  { label: "widget language", regex: /\bwidgets?\b/i },
  { label: "sovereignty language", regex: /\bsovereign\b/i },
  { label: "judgment language", regex: /\bjudg(?:e)?ment\b/i },
  { label: "route airlock", regex: /route airlock/i },
  { label: "context packet", regex: /context packet/i },
  { label: "route target", regex: /route target/i },
  { label: "trust mode", regex: /trust mode/i },
  { label: "implementation storage", regex: /\bOPFS\b/i },
  { label: "deterministic fallback", regex: /deterministic .*fallback|local deterministic fallback/i },
  { label: "adapter/runtime term", regex: /local-webgpu|adapter|runtime/i },
  { label: "gateway jargon", regex: /\bgateway\b/i },
  { label: "provider jargon", regex: /\bprovider\b/i },
  { label: "frontend jargon", regex: /\bfrontend\b/i },
  { label: "architecture-first copy", regex: /\barchitecture\b/i },
  { label: "protocol-first copy", regex: /\bprotocol\b/i },
  { label: "early-access framing", regex: /early access/i },
  { label: "demo framing", regex: /\bdemo\b/i },
  { label: "paternal promise", regex: /need to hear|want to hear/i },
  { label: "wordy honesty phrasing", regex: /honest next move/i },
  { label: "internal proof-sprint phrasing", regex: /proof sprint|proof-sprint/i },
  { label: "internal setup copy", regex: /Getting honest pushback|How should I push back|Push back/i },
  { label: "diagnostic audience language", regex: /\bADHD\b|neurodivergent|neuroD/i },
];

const runtimePatterns = [
  { label: "public runtime status", regex: /Preview context packet|Packet ready|Route target|trust mode|demo packet/i },
  { label: "public runtime internals", regex: /local-webgpu|deterministic .*fallback|gateway route|provider fallback/i },
  { label: "public runtime route copy", regex: /Generated workspace route|Route Airlock|Sovereign/i },
  { label: "public runtime proof-sprint phrasing", regex: /proof sprint|proof-sprint/i },
];

function visibleText(html) {
  return html
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

const findings = [];

for (const file of htmlFiles) {
  const text = visibleText(readFileSync(file, "utf8"));
  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) findings.push({ file, label: pattern.label, match: match[0] });
  }
}

for (const file of runtimeFiles) {
  const text = readFileSync(file, "utf8");
  for (const pattern of runtimePatterns) {
    const match = text.match(pattern.regex);
    if (match) findings.push({ file, label: pattern.label, match: match[0] });
  }
}

if (findings.length) {
  console.error("Public copy audit failed:");
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.label} -> "${finding.match}"`);
  }
  process.exit(1);
}

console.log("Public copy audit passed.");

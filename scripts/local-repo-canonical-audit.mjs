import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const reposRoot = process.env.ACTIVE_MIRROR_REPOS_ROOT || "/Users/mirror-pro/repos";
const publicDomain = "activemirror.ai";
const strict = process.env.ACTIVE_MIRROR_REPO_AUDIT_STRICT === "true";
const expected = {
  "active-mirror-site": { domain: publicDomain, kind: "canonical-deploy", path: "public/CNAME" },
  "active-mirror-identity": { domain: "id.activemirror.ai", kind: "compatibility", path: "CNAME" },
};

const failures = [];
const warnings = [];
const claims = [];

function read(path) {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return "";
  }
}

for (const entry of readdirSync(reposRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const repo = entry.name;
  if (!/active.?mirror|activemirror|mirrordna|mirrorbrain/i.test(repo)) continue;

  const root = join(reposRoot, repo);
  for (const candidate of ["CNAME", "public/CNAME"]) {
    const path = join(root, candidate);
    if (!existsSync(path)) continue;
    const domain = read(path);
    if (domain) claims.push({ repo, file: candidate, domain });
  }
}

for (const [repo, rule] of Object.entries(expected)) {
  const domain = read(join(reposRoot, repo, rule.path));
  if (domain !== rule.domain) {
    failures.push(`${repo}/${rule.path} must be ${rule.domain}, got ${domain || "(missing)"}`);
  }
}

if (existsSync(join(reposRoot, "activemirror-journey", "CNAME"))) {
  failures.push("activemirror-journey must not contain CNAME; it is source-only.");
}

for (const claim of claims) {
  const expectedRule = expected[claim.repo];
  if (expectedRule && claim.file === expectedRule.path && claim.domain === expectedRule.domain) continue;
  if (claim.domain === publicDomain) {
    warnings.push(`${claim.repo}/${claim.file} still claims ${publicDomain}; treat as legacy unless deliberately cleaned.`);
  }
}

const exitCode = failures.length > 0 ? 1 : (strict && warnings.length > 0 ? 2 : 0);
const status = failures.length > 0
  ? "failure"
  : (warnings.length > 0 ? (strict ? "strict_failure" : "warning") : "pass");

console.log(JSON.stringify({
  ok: exitCode === 0,
  status,
  strict,
  exit_code: exitCode,
  repos_root: reposRoot,
  claims,
  warnings,
  failures,
}, null, 2));

if (exitCode !== 0) process.exit(exitCode);

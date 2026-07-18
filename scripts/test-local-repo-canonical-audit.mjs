#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AUDIT = fileURLToPath(new URL("./local-repo-canonical-audit.mjs", import.meta.url));
const tempRoot = await mkdtemp(join(tmpdir(), "active-mirror-repo-audit-"));

try {
  await check("clean ownership passes in default mode", async () => {
    const reposRoot = await makeFixture("clean");
    const result = await runAudit(reposRoot);

    assert.equal(result.code, 0, result.stderr || result.stdout);
    assert.equal(result.report.ok, true);
    assert.equal(result.report.status, "pass");
    assert.equal(result.report.strict, false);
    assert.equal(result.report.exit_code, 0);
    assert.deepEqual(result.report.warnings, []);
    assert.deepEqual(result.report.failures, []);
  });

  await check("legacy ownership claim is a machine-readable warning by default", async () => {
    const reposRoot = await makeFixture("default-warning", { legacyClaim: true });
    const result = await runAudit(reposRoot);

    assert.equal(result.code, 0, result.stderr || result.stdout);
    assert.equal(result.report.ok, true);
    assert.equal(result.report.status, "warning");
    assert.equal(result.report.strict, false);
    assert.equal(result.report.exit_code, 0);
    assert.equal(result.report.warnings.length, 1);
    assert.deepEqual(result.report.failures, []);
  });

  await check("legacy ownership claim fails truthfully in strict mode", async () => {
    const reposRoot = await makeFixture("strict-warning", { legacyClaim: true });
    const result = await runAudit(reposRoot, { strict: true });

    assert.equal(result.code, 2, result.stderr || result.stdout);
    assert.equal(result.report.ok, false);
    assert.equal(result.report.status, "strict_failure");
    assert.equal(result.report.strict, true);
    assert.equal(result.report.exit_code, 2);
    assert.equal(result.report.warnings.length, 1);
    assert.deepEqual(result.report.failures, []);
  });

  await check("canonical ownership defect remains a hard failure", async () => {
    const reposRoot = await makeFixture("hard-failure", { canonicalDomain: "wrong.example" });
    const result = await runAudit(reposRoot, { strict: true });

    assert.equal(result.code, 1, result.stderr || result.stdout);
    assert.equal(result.report.ok, false);
    assert.equal(result.report.status, "failure");
    assert.equal(result.report.strict, true);
    assert.equal(result.report.exit_code, 1);
    assert.equal(result.report.failures.length, 1);
  });
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function makeFixture(name, options = {}) {
  const reposRoot = join(tempRoot, name);
  const canonicalDomain = options.canonicalDomain || "activemirror.ai";

  await write(join(reposRoot, "active-mirror-site", "public", "CNAME"), `${canonicalDomain}\n`);
  await write(join(reposRoot, "active-mirror-identity", "CNAME"), "id.activemirror.ai\n");
  await mkdir(join(reposRoot, "activemirror-journey"), { recursive: true });

  if (options.legacyClaim) {
    await write(join(reposRoot, "activemirror-legacy", "CNAME"), "activemirror.ai\n");
  }

  return reposRoot;
}

async function write(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

function runAudit(reposRoot, options = {}) {
  const env = {
    ...process.env,
    ACTIVE_MIRROR_REPOS_ROOT: reposRoot,
  };

  if (options.strict) {
    env.ACTIVE_MIRROR_REPO_AUDIT_STRICT = "true";
  } else {
    delete env.ACTIVE_MIRROR_REPO_AUDIT_STRICT;
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [AUDIT], { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      let report;
      try {
        report = JSON.parse(stdout);
      } catch (error) {
        return reject(new Error(`Audit emitted invalid JSON: ${error.message}\n${stdout}\n${stderr}`));
      }
      resolve({ code, stdout, stderr, report });
    });
  });
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

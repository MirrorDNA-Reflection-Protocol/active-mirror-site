#!/usr/bin/env node

const loops = [
  {
    id: "cloudflare_r2_media_storage",
    aliases: [
      "r2",
      "cloudflare",
      "wrangler",
      "media",
      "image",
      "poster",
      "signed url",
      "bucket",
      "10042",
    ],
    repo: "/Users/mirror-pro/repos/active-mirror-site",
    firstChecks: [
      "npm run cf:whoami",
      "npm run cf:r2:list",
      "curl -fsS https://gateway.activemirror.ai/health",
    ],
    gates: [
      "npm run cf:r2:list",
      "npm run worker:test",
      "npm run worker:deploy",
      "npm run canary:prod",
      "npm run smoke:browser",
      "npm run redteam:prod-smoke",
    ],
    blocker:
      "If R2 returns code 10042, the Cloudflare account needs R2 enabled in Dashboard before code can finish.",
  },
  {
    id: "public_site_ship_loop",
    aliases: ["homepage", "site", "deploy", "copy", "route", "public", "front door"],
    repo: "/Users/mirror-pro/repos/activemirror-journey",
    deployRepo: "/Users/mirror-pro/repos/active-mirror-site",
    firstChecks: [
      "git status --short",
      "npm run guard:language",
      "npm run build:deploy",
    ],
    gates: [
      "npm run app:package",
      "npm run deploy:preflight",
      "npm run worker:deploy",
      "npm run site:worker:deploy",
      "npm run canary:prod",
      "npm run smoke:browser",
      "npm run qa:live-user",
    ],
    blocker: "Preserve unrelated dirty files and keep consumer copy free of internal jargon.",
  },
  {
    id: "identity_and_model_route_loop",
    aliases: ["identity", "model", "provider", "chatgpt", "claude", "gemini", "route"],
    repo: "/Users/mirror-pro/repos/active-mirror-site",
    firstChecks: [
      "curl -fsS https://gateway.activemirror.ai/health",
      "npm run canary:prod",
    ],
    gates: ["npm run worker:test", "npm run canary:prod"],
    blocker:
      "Visible assistant identity must remain Active Mirror; provider names are operator details unless explicitly requested.",
  },
  {
    id: "user_experience_friction_loop",
    aliases: ["confusing", "friction", "boring", "canned", "genui", "canvas", "ux", "friend"],
    repo: "/Users/mirror-pro/repos/activemirror-journey",
    firstChecks: [
      "npm run guard:language",
      "ACTIVE_MIRROR_USER_QA_CASES=3 npm run qa:user-prompts",
    ],
    gates: ["npm run build:deploy", "npm run qa:user-prompts", "npm run smoke:browser", "npm run qa:live-user"],
    blocker:
      "Chat stays primary; canvas/artifacts appear only when useful and should produce the thing, not instructions.",
  },
  {
    id: "continuity_and_bad_news_loop",
    aliases: ["what else", "what next", "remind", "again", "drift", "blocked", "continuity"],
    repo: "/Users/mirror-pro/repos/active-mirror-site",
    firstChecks: [
      "rg -n \"<exact blocker>|<repo>|<route>\" /Users/mirror-pro/.codex/memories/MEMORY.md",
      "python3 /Users/mirror-pro/.mirrordna/scripts/graph_funnel.py search <topic>",
    ],
    gates: ["name exact blocker", "add durable rail", "state next safe move"],
    blocker: "If the same blocker recurs, create a command, guard, or runbook before continuing.",
  },
];

function scoreLoop(loop, query) {
  const q = query.toLowerCase();
  return loop.aliases.reduce((score, alias) => {
    return q.includes(alias.toLowerCase()) ? score + alias.length : score;
  }, 0);
}

function printLoop(loop) {
  const printable = {
    id: loop.id,
    repo: loop.repo,
    deployRepo: loop.deployRepo,
    firstChecks: loop.firstChecks,
    gates: loop.gates,
    blocker: loop.blocker,
  };
  console.log(JSON.stringify(printable, null, 2));
}

const [command, ...rest] = process.argv.slice(2);

if (!command || command === "list") {
  console.log(loops.map((loop) => loop.id).join("\n"));
  process.exit(0);
}

if (command === "match") {
  const query = rest.join(" ").trim();
  if (!query) {
    console.error("Usage: node scripts/task-loop.mjs match <task text>");
    process.exit(64);
  }
  const ranked = loops
    .map((loop) => ({ loop, score: scoreLoop(loop, query) }))
    .sort((a, b) => b.score - a.score);
  if (!ranked[0] || ranked[0].score === 0) {
    console.error("No matching task loop. Add one before proceeding.");
    process.exit(2);
  }
  printLoop(ranked[0].loop);
  process.exit(0);
}

const exact = loops.find((loop) => loop.id === command);
if (exact) {
  printLoop(exact);
  process.exit(0);
}

console.error(`Unknown loop command or id: ${command}`);
process.exit(64);

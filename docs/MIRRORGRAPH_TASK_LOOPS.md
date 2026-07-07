# MirrorGraph Task Loops

Purpose: route repeatable Active Mirror work through named loops instead of
rediscovering tools, repos, gates, and blockers every session.

This is internal operator memory. Do not copy this language to the public site.

Executable helper:

```bash
npm run loops
npm run loops:match -- "R2 poster image storage"
node scripts/task-loop.mjs cloudflare_r2_media_storage
```

## Loop Contract

Every loop should define:

- intent trigger
- active repo and deploy surface
- required skills/tools
- first live check
- edit surface
- verification gates
- blocker receipt
- next safe move

## `cloudflare_r2_media_storage`

Intent triggers:

- image/poster artifacts fail in browser
- media URL storage needs hardening
- `media_storage=edge_cache_ephemeral`
- R2 bucket, media bucket, signed media URL, Cloudflare access

Active repo:

- deploy/gateway: `/Users/mirror-pro/repos/active-mirror-site`
- product source: `/Users/mirror-pro/repos/activemirror-journey`

Required tools:

- `cloudflare:wrangler`
- `scripts/cloudflare-wrangler.mjs`
- official Cloudflare docs for current CLI/config behavior

First checks:

```bash
npm run cf:whoami
npm run cf:r2:list
curl -fsS https://gateway.activemirror.ai/health
```

Rules:

- do not use raw `npx wrangler` when stale Cloudflare env tokens may exist
- do not commit API tokens
- do not claim R2 is configured unless `cf:r2:list` works and health reports R2
- if R2 returns `10042`, the next action is dashboard entitlement, not code

Success gates:

```bash
npm run cf:r2:list
npm run worker:test
npm run worker:deploy
npm run canary:prod
npm run smoke:browser
npm run redteam:prod-smoke
```

Current blocker:

```text
Cloudflare R2 account entitlement is missing:
Please enable R2 through the Cloudflare Dashboard. [code: 10042]
```

## `public_site_ship_loop`

Intent triggers:

- homepage/app UI change
- copy or route cleanup
- public Active Mirror site deploy

Active repo split:

- source: `/Users/mirror-pro/repos/activemirror-journey`
- deploy/gateway: `/Users/mirror-pro/repos/active-mirror-site`

First checks:

```bash
git status --short
npm run guard:language
npm run build:deploy
```

Deploy bridge:

```bash
npm run app:package
npm run deploy:preflight
npm run worker:deploy
npm run site:worker:deploy
```

Success gates:

```bash
npm run canary:prod
npm run smoke:browser
npm run redteam:prod-smoke
```

Rules:

- keep consumer copy simple, chat-first, and outcome-first
- no internal AMOS, mesh, gateway, R2, OPFS, or proof jargon on the front door
- preserve unrelated dirty files

## `identity_and_model_route_loop`

Intent triggers:

- “what model is connected?”
- identity leakage
- model/provider names visible to users
- Active Mirror answers as ChatGPT/Claude/Gemini

Active repo:

- deploy/gateway: `/Users/mirror-pro/repos/active-mirror-site`

First checks:

```bash
curl -fsS https://gateway.activemirror.ai/health
npm run canary:prod
```

Success rules:

- visible assistant identity is Active Mirror
- provider/model names stay implementation details unless an operator page asks
- identity prompts must not route through provider self-description
- gateway health must expose route truth for operator inspection

## `user_experience_friction_loop`

Intent triggers:

- user says the site is confusing
- response UI feels canned
- too much GenUI
- friend/tester gets blocked or frustrated

Active repo:

- source: `/Users/mirror-pro/repos/activemirror-journey`

First checks:

```bash
npm run guard:language
ACTIVE_MIRROR_USER_QA_CASES=3 npm run qa:user-prompts
```

Rules:

- chat is primary
- canvas/artifact appears only when useful
- ask fewer questions; act when intent is clear
- no internal terms in consumer UI
- poster/image/document requests should produce an artifact, not instructions

Success gates:

```bash
npm run build:deploy
npm run qa:user-prompts
npm run smoke:browser
```

## `continuity_and_bad_news_loop`

Intent triggers:

- “what were we doing?”
- repeated tool/access failure
- user says they have to remind the agent
- blocker recurs more than once

First checks:

```bash
rg -n "<exact blocker>|<repo>|<route>" /Users/mirror-pro/.codex/memories/MEMORY.md
python3 /Users/mirror-pro/.mirrordna/scripts/graph_funnel.py search <topic>
```

Rules:

- bad news first
- no fake completion
- convert repeated failures into a command, guard, or runbook
- if the same blocker recurs, create a loop artifact before continuing

Output:

- exact blocker
- durable rail added or missing
- next safe move

## What Paul Is Circling

Paul is circling the need for a task-native mirror runtime:

```text
intent -> graph loop -> tools -> gates -> action -> receipt -> memory -> next loop
```

The product version is the same pattern for users:

```text
what do you want -> mirror intent -> act/use tools -> produce something useful
-> remember only what is approved -> improve next time
```

The internal system and public product should rhyme, but the public product must
not expose the machinery unless the user is on an enterprise/operator surface.

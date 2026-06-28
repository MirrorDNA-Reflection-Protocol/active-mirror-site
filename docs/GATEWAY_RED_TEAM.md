# Gateway Red Team

Run the gateway route without logging user content.

Production is protected by public rate and daily budget limits, so the default
production command is a short smoke. Full 100-turn runs should target local or
staging gateways unless you deliberately opt into production stress.

```sh
npm run redteam:gateway
```

Safe commands:

```sh
npm run redteam:prod-smoke
npm run redteam:local
npm run redteam:live-local
```

Defaults:

- Production gateway: `ACTIVE_MIRROR_RED_TEAM_TURNS=20`
- Local/in-process gateway: `ACTIVE_MIRROR_RED_TEAM_TURNS=100`
- `ACTIVE_MIRROR_RED_TEAM_CONCURRENCY=1`
- `ACTIVE_MIRROR_RED_TEAM_DELAY_MS=2000`

The runner splits traffic across session IDs, respects 429 retry windows, prints
progress to stderr, and prints a final JSON summary to stdout. The local command
runs the Worker in-process with a deterministic test bridge, so it does not use
provider secrets, Cloudflare, or public gateway budget.

`redteam:live-local` also runs the Worker in-process, but routes through local
provider environment variables. It defaults to 20 turns and is for smaller
real-model quality checks without spending the public gateway budget. Set
`ACTIVE_MIRROR_LIVE_PRIMARY=openai|anthropic|gemini` to choose the first provider
for that run.

To force a production stress run, set:

```sh
ACTIVE_MIRROR_RED_TEAM_ALLOW_PROD_STRESS=1 ACTIVE_MIRROR_RED_TEAM_TURNS=100 npm run redteam:gateway
```

Do this only when you intentionally want to spend the public production test
budget.

## Coverage

- stuck and vague asks
- sycophancy bait
- drift and overbuilding prompts
- current-fact traps
- secrets
- self-harm and harmful planning
- professional advice boundaries
- consumer reflection
- product and enterprise prompts

## Latest Receipt

Date: 2026-06-28

Worker version: `2026-06-28-provider-primary-v1`

Result:

- Local deterministic in-process Worker red-team: 100/100 passed, `fallback_count=0`, `rate_limited_count=0`, average latency about 1 ms.
- Local truth states: 72 `reflective`, 20 `needs_checking`, 8 blocked/none.
- Local straitjacket events: 20 `truth_state_needs_sources`, 12 `safety_redirect`.
- Live-provider in-process Worker smoke: 20/20 passed, `fallback_count=0`, `rate_limited_count=0`, average latency about 3282 ms.
- Production red-team smoke: 20/20 passed, `fallback_count=0`, `rate_limited_count=0`, average latency about 4736 ms after Worker deploy.
- Earlier 100-turn production stress hit public 429 limits. That was a budget result, not a reflection or safety-shape failure.

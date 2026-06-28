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
npm run worker:dev
npm run redteam:local
```

Defaults:

- Production gateway: `ACTIVE_MIRROR_RED_TEAM_TURNS=20`
- Local/staging gateway: `ACTIVE_MIRROR_RED_TEAM_TURNS=100`
- `ACTIVE_MIRROR_RED_TEAM_CONCURRENCY=1`
- `ACTIVE_MIRROR_RED_TEAM_DELAY_MS=2000`

The runner splits traffic across session IDs, respects 429 retry windows, prints
progress to stderr, and prints a final JSON summary to stdout.

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

Worker version: `2026-06-27-mirrorseed-proof-v1`

Result:

- 100 production turns were attempted during hardening.
- Reflection/safety assertions held until the public rate limiter tripped.
- Failures were 429 `rate_limited` responses, not reflection or safety-shape failures.
- The script now defaults production to 20 turns and reserves 100-turn runs for local/staging or explicit production override.

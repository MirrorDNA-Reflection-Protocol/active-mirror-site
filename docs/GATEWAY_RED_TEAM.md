# Gateway Red Team

Run the live model route without logging user content:

```sh
npm run redteam:gateway
```

Default settings:

- `ACTIVE_MIRROR_RED_TEAM_TURNS=100`
- `ACTIVE_MIRROR_RED_TEAM_CONCURRENCY=1`
- `ACTIVE_MIRROR_RED_TEAM_DELAY_MS=2000`

The runner splits traffic across session IDs so the 100-turn run does not fight the daily session budget. It prints progress to stderr and a final JSON summary to stdout.

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

Date: 2026-06-27

Worker version: `2026-06-27-personality-v1`

Result:

- 100 turns
- 0 failures
- 0 provider fallbacks
- average latency: 5703 ms
- 21 turns marked `needs_checking`
- 12 safety redirects
- 2 flattery removals

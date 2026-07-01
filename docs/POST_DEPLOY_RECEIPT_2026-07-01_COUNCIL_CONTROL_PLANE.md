# Post-Deploy Receipt: Council Control Plane

## Target

- Surface: `https://gateway.activemirror.ai`
- Service: `active-mirror-site-gateway`
- Deployment command: `npm run worker:deploy`
- Deployed Worker version string: `2026-07-01-council-control-plane-v1`
- Deployed Cloudflare Worker version id: `b799e1a2-7d86-4ba6-a90a-5d4dbae90085`
- Previous rollback version id: `3c4097df-603e-4e1b-b467-82550381e1c9`

## Promoted Contract

- `mirror_loop_v1`
- `recursive_perfection_lock_v1`
- `resolution_contract_v1`
- `reflection_promotion_v1`
- `active_mirror_council_control_plane_v1`

The live gateway now exposes the council control plane through `/health` and
MirrorDash Glass. The council route is
`intent_router_to_council_to_receipt_to_promotion_gate`.

## Pre-Deploy Checks

- `node --check worker/src/index.js`: pass
- `node --check scripts/production-canary.mjs`: pass
- `git diff --check`: pass
- `npm run worker:test`: pass
- `npm run build`: pass
- Wrangler OAuth deploy-mode auth: pass

## Post-Deploy Checks

- `npm run canary:prod`: pass, `13/13`
- `curl -fsS https://gateway.activemirror.ai/health`: pass, returned
  `2026-07-01-council-control-plane-v1`
- `npm run monitor:gateway`: pass after updating stale local monitor version
  expectation

## Bad News And Resolution

The first post-deploy `npm run monitor:gateway` run failed because the local
monitor script still expected an older Worker version pattern. Production itself
was serving the new version and the production canary passed. The monitor was
patched to require the new council control-plane version and council guardrails,
then rerun successfully.

## Remaining Risk

- This receipt proves the Cloudflare gateway deployment and live route checks.
- It does not prove every client-visible renderer is physically gated before
  display.
- The governed Codex wrapper route is gated, but Codex Desktop visible chat is
  still tracked as `UNGATED_CLIENT` by the local ungated-surface inventory.

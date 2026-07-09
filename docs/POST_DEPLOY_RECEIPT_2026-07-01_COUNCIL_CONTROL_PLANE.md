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

## Local Hardening Follow-Up: 2026-07-01 Runtime Gates

Status: `PARTIAL`.

Council owner: `runtime`.

Source check:

- `/Users/mirror-pro/repos/active-mirror-site/docs/ACTIVE_MIRROR_ALGORITHM.md`
  requires every incomplete state to become `resolution_contract_v1`.
- `/Users/mirror-pro/repos/active-mirror-site/docs/ACTIVE_MIRROR_COUNCIL_CONTROL_PLANE.md`
  allows local docs, guardrails, receipts, and backlog items through the daily
  hardening loop.
- `/Users/mirror-pro/.codex/automations/active-mirror-genui-browser-os-intelligence-scan/runs/20260701T142237Z`
  captured the seven local gate receipts for this follow-up.

Checked scope:

- `python3 /Users/mirror-pro/.mirrordna/scripts/memory_signature_gate.py self-check`
- `python3 /Users/mirror-pro/.mirrordna/scripts/honesty_kernel.py self-check`
- `python3 /Users/mirror-pro/.mirrordna/scripts/codex_wrapper_gate_probe.py self-check`
- `python3 /Users/mirror-pro/.mirrordna/scripts/ungated_surface_inventory.py self-check`
- `python3 /Users/mirror-pro/.mirrordna/scripts/final_output_proxy.py self-check`
- `python3 /Users/mirror-pro/.mirrordna/scripts/trust_by_design_protocol.py self-check --no-write`
- `python3 /Users/mirror-pro/.mirrordna/scripts/agent_session_bridge.py self-check --all --json`

Unchecked scope:

- No Codex Desktop client pre-display hook was proven.
- No live Claude Code visible-renderer final text receipt was captured.
- No production deploy, restart, Cloudflare mutation, Hetzner mutation, model
  training, adapter change, or broad repo cleanup was performed.

Bad news:

- Codex Desktop visible chat remains `UNGATED_CLIENT`.
- Claude Code visible output remains `PARTIAL`.
- `agent_session_bridge.py self-check --all --json` passed, but emitted a
  large all-actor JSON receipt of about 940 KB.

Resolution contracts:

```json
[
  {
    "id": "codex-desktop-visible-renderer-ungated",
    "schema": "resolution_contract_v1",
    "status": "open",
    "blocker": "No supported pre-display final-output gate is proven for the exact Codex Desktop visible chat renderer.",
    "fix_path": "Use a supported client pre-display hook, an external governed renderer, or the governed wrapper route for high-trust file handoffs.",
    "owner": "runtime",
    "command_or_file": "python3 /Users/mirror-pro/.mirrordna/scripts/codex_desktop_gate_probe.py self-check",
    "proof_needed": "physical_gate_proven=true for the exact Codex Desktop renderer, otherwise keep UNGATED_CLIENT in inventory.",
    "auto_fixable": false,
    "next_search_path": "Codex Desktop supported pre-display hook surface or external governed renderer."
  },
  {
    "id": "claude-code-visible-renderer-partial",
    "schema": "resolution_contract_v1",
    "status": "open",
    "blocker": "Claude Stop routing exists, but visible-output enforcement still depends on live final text or transcript_path proof for the exact client build.",
    "fix_path": "Capture a live Claude Stop receipt that proves final_output_proxy.py evaluated the displayed response before acceptance.",
    "owner": "runtime",
    "command_or_file": "python3 /Users/mirror-pro/.mirrordna/scripts/ungated_surface_inventory.py self-check",
    "proof_needed": "Live Stop receipt with final text or transcript_path evaluated before visible output is accepted.",
    "auto_fixable": false,
    "next_search_path": "/Users/mirror-pro/.mirrordna/scripts/claude_stop_gate.py transcript extraction receipt path."
  },
  {
    "id": "agent-session-bridge-oversized-receipt",
    "schema": "resolution_contract_v1",
    "status": "open",
    "blocker": "The all-actor bridge gate passes but emits an oversized JSON receipt that is hard to use in compact automation reports.",
    "fix_path": "Add or verify a compact bridge receipt mode after current /Users/mirror-pro/.mirrordna/scripts/agent_session_bridge.py ownership is clear.",
    "owner": "runtime",
    "command_or_file": "/Users/mirror-pro/.mirrordna/scripts/agent_session_bridge.py",
    "proof_needed": "Compact receipt with generated_at, top-level ok, per-actor ok, warning counts, failure counts, and a full receipt drilldown path.",
    "auto_fixable": "true after dirty ownership is resolved",
    "next_search_path": "agent_session_bridge.py self_check output writer and /Users/mirror-pro/.mirrordna/health/agent_session_bridge.json."
  }
]
```

Promotion decision: `promote_docs_only`.

Remaining risk: this follow-up records exact contracts for known local runtime
gaps. It does not close the gaps and must not be used to claim every visible
client renderer is gated.

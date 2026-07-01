# Active Mirror Council Control Plane

## Charter

The harness is the product. Models are swappable workers.

The council control plane exists to keep every worker answer routed through
Active Mirror identity, source truth, receipts, and promotion gates before it is
treated as product output.

Control id: `active_mirror_council_control_plane_v1`.

Route: `intent_router_to_council_to_receipt_to_promotion_gate`.

Hard stop: `trust_by_design_or_hardstop`.

Promotion gate: `reflection_promotion_v1`.

## Councils

Each council is a bounded review role, not simulated consensus. A council can be
implemented by Codex, Claude Code, Gemini, a local model, a script, a human, or a
future harness, but its output remains advisory until the receipt passes.

| Council | Scope | Default allowed actions | Hard stop |
| --- | --- | --- | --- |
| Thread | Codex threads, worktrees, handoffs, active context | list, read, send bounded messages, produce handoff receipts | creating user-owned threads or widening scope without explicit request |
| Source | Web, GitHub, Hugging Face, arXiv, papers, standards, docs | source-check, rank sources, produce verification plans | unsupported current claims |
| Runtime | kernels, hooks, launchers, fail-safe, final-output proxy | local self-checks, docs, tests, guardrail patches | production deploys, restarts, Cloudflare, Hetzner without approval |
| Ops | automations, schedules, registries, receipts | inspect, consolidate, update approved Codex automations | destructive cleanup or external mutation without receipt and approval |
| Design | browser, Playwright, screenshots, UI proof | visual QA, copy lint, local proof artifacts | claiming visible changes without screenshot or route proof |
| Security | threat model, secrets, boundaries, abuse checks | scans, risk notes, safer routing, blocked-action receipts | routing secrets or unsafe actions to models/tools |
| State | memory, vault, claim ledger, provenance, signatures | signed manifest checks, claim ledgers, source-backed memory candidates | raw vault training or unsigned memory as authority |
| Promotion | docs, tests, guardrails, backlog, source queries, candidates | promote only reversible local artifacts with proof | model weights, LoRA, training data, deploy, or external write without approval |

## Receipt

Every council pass returns a compact receipt:

```json
{
  "council_id": "source",
  "task": "verify current model orchestration claim",
  "inputs": ["current_turn", "approved_context"],
  "actions_taken": ["source_check"],
  "evidence": ["url_or_file_or_command_receipt"],
  "resolution_contracts": [],
  "promotion_decision": "promote_docs_only",
  "verification": ["command_or_source"],
  "remaining_risk": ["unchecked_scope"]
}
```

## Promotion Rules

Allowed without separate approval when local, reversible, and verified:

- docs;
- tests;
- guardrails;
- backlog items;
- source-check query packs;
- automation prompt refinements;
- memory candidates;
- adapter candidates.

Blocked without separate explicit approval:

- production deploy;
- Cloudflare, Hetzner, or other external mutation;
- model weights;
- LoRA promotion;
- training-data promotion;
- raw vault ingestion;
- destructive cleanup;
- creating new user-owned Codex threads unless Paul asked for one.

## Thread Orchestration

The active thread is the arbiter. Worker threads or agents receive bounded
prompts, bounded context, and a receipt requirement. They do not get to mark
their own work done without a main-thread verification pass.

Use thread tools only when the user explicitly asks to create, fork, inspect,
continue, hand off, pin, archive, rename, or message threads. For subtasks inside
one answer, prefer local tools and receipts over extra user-visible threads.

## Daily Loop

The scheduled hardening loop must route each selected slice through the relevant
council before promotion:

1. classify intent and scope;
2. choose one council owner;
3. gather evidence;
4. create or close a `resolution_contract_v1`;
5. promote only an allowed target;
6. record checks and remaining risk.

If no council can produce evidence and a safe local change, the correct output is
a no-change receipt with the next search path.

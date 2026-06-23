# Active Mirror / AMOS Design-Thinking System

This is the internal translation layer between product thinking, AI agent execution, and the public Active Mirror experience.

Commercial definition:

> Active Mirror is design thinking for AI agents: clarify the human goal, define the task, generate routes, prototype outputs, test with receipts, and only then act.

Category sentence:

> Active Mirror is the trust layer for AI agents: it gives models memory, permissions, evaluation, rollback, and receipts before they act.

This system is not "memory with a chat box." Memory is one part of the loop. The full product is a reflective execution system: it helps a person state intent, sets boundaries, routes work through the right tools and roles, evaluates the output, records the receipt, and remembers only approved defaults.

## Current Research Signal

- CritiqueCrew validates structured role orchestration: UX, PM, and Engineer perspectives produced better design critique and user experience than a static checker.
- Figma2Code validates the boundary: Figma metadata is useful, but direct design-to-production code remains weak on responsiveness and maintainability.
- Human-on-the-Bridge validates reusable evaluator design: jurors, traps, source rules, fallback rules, and evidence-linked reports are a better pattern than one generic judge.
- The 2026 agent market validates the risk: orchestration is becoming infrastructure, so Active Mirror should sit above orchestrators as the user-visible trust and control plane.

Working rule:

```text
Figma workshop -> validated user flow -> component system -> prototype -> coded implementation -> QA harness -> receipts
```

## Two Separate Build Tracks

### 1. Design-Thinking System

Use these canvases to shape the user's mirror, task, consent, memory, tools, outputs, and receipts before building or acting.

- [MirrorDNA onboarding canvas](templates/mirrordna-onboarding-canvas.md)
- [Consent boundary map](templates/consent-boundary-map.md)
- [Default Ledger canvas](templates/default-ledger-canvas.md)
- [ToolGraph map](templates/toolgraph-map.md)
- [Agent action approval flow](templates/agent-action-approval-flow.md)
- [Memory lifecycle map](templates/memory-lifecycle-map.md)
- [Drift reset / somatic reset flow](templates/drift-reset-somatic-reset-flow.md)
- [Session receipt template](templates/session-receipt-template.md)
- [Reflective execution report](templates/reflective-execution-report.md)
- [Skill creation and retirement flow](templates/skill-creation-retirement-flow.md)
- [Role critique panel](templates/role-critique-panel.md)

### 2. AMOS Build Path

Use this to build the runtime separately from the public homepage and design workshops.

- [AMOS build path v0](amos-build-path-v0.md)
- [Market position v0](market-position-v0.md)
- [AMOS Control Plane v0](templates/amos-control-plane-v0.md)
- [MirrorBench v0](templates/mirrorbench-v0.md)
- [MirrorEval v0](templates/mirroreval-v0.md)
- [MirrorSkills v0](templates/mirrorskills-v0.md)
- [Dispatch v0](templates/dispatch-v0.md)

## Role Orchestration

Every serious Active Mirror flow should be reviewed by at least three roles:

| Role | Primary question |
| --- | --- |
| Human owner | Is this actually what I want to move forward? |
| Mirror facilitator | Did we reflect before acting? |
| UX reviewer | Can the user understand and recover? |
| PM reviewer | Does this solve the real job and avoid feature drift? |
| Engineer reviewer | Can this be built, tested, maintained, and rolled back? |
| Privacy reviewer | Did we minimize, gate, and receipt sensitive context? |
| QA reviewer | What would fail in the real workflow? |

## Preflight

Before design, code, or agent action:

1. State the human goal in one sentence.
2. Classify facts, estimates, and unknowns.
3. Select the allowed tools.
4. Set the consent boundary.
5. Pick the evidence required to call the work done.
6. Decide what may be remembered.
7. Name the fallback if the route fails.

## Postflight

After design, code, or agent action:

1. Compare planned route vs actual route.
2. Record context used and context excluded.
3. Attach evidence, screenshots, logs, source links, or file paths.
4. Identify what changed, what did not, and what remains unknown.
5. Ask whether any memory/default should be promoted.
6. Emit a session receipt.

## Non-Negotiables

- Do not route private context to external tools without explicit approval.
- Do not treat Figma output as production implementation.
- Do not rely on one model or one judge for high-risk work.
- Do not promote memory by implication.
- Do not hide uncertainty; put it in FEU: Facts, Estimates, Unknowns.
- Do not let the public site become a brochure when the product is an interactive workspace.
- Do not sell Active Mirror as "an orchestrator." Orchestration is a substrate. Active Mirror is the trust/control plane above it.

# Active Mirror UX Stress Kit

Date: 2026-06-21

This kit turns the Active Mirror product doctrine into repeatable UX gates. It is not a marketing artifact. It is a release-readiness system for checking whether the product is inspectable, interruptible, reversible, consent-aware, memory-aware, context-minimal, local-first where possible, and safe across agents, tools, devices, and client boundaries.

## Core Test

Every meaningful Active Mirror screen should let the user answer:

1. What does the mirror know?
2. Where did that knowledge come from?
3. Is it verified, inferred, stale, sensitive, or conflicting?
4. What context is being used for this task?
5. What is the AI allowed to do?
6. What is the AI about to do?
7. Can the user stop, edit, revoke, undo, or roll back?

If the user cannot answer those questions, the UX fails.

## Product Rule

The workspace is the interface. The product is the user-owned consent, continuity, memory, and context-control layer for AI work.

External language:

> Active Mirror makes AI inspectable, interruptible, reversible, and consent-aware.

Internal doctrine:

> Memory is not authority. Consent is authority.

## Files

- `doctrine.md`: Product doctrine and non-negotiable UX rules.
- `figma-pages.md`: Recommended design-file structure and page acceptance checks.
- `components.md`: Component contracts for memory, consent, context, audit, and recovery UI.
- `test-matrix.csv`: Release-gate scenarios and severity.
- `prompts/`: AI QA prompts for UX, consent red-team, and memory leakage review.
- `schemas/`: JSON Schemas for memory cards, context packets, and audit events.
- `reports/release-readiness-template.md`: Compact release report template.
- `playwright/`: Test templates. These are not wired into `package.json` until Playwright is intentionally added.

## Minimum Release Gate

- No P0 or P1 safety failures.
- Consent average >= 4.
- Memory visibility average >= 4.
- Context routing average >= 4.
- Recovery average >= 3.5.
- Accessibility and cognitive-load average >= 4.

## Current Product Mapping

The current `/mirror/` surface already proves part of the doctrine:

- intent capture;
- boundary selection;
- gateway route;
- generated viewport;
- receipt display;
- local fallback.

The next product slice should add:

- context packet preview before gateway calls;
- explicit include/exclude/redact decisions;
- memory decision state;
- route truth and fallback reason;
- local/cloud boundary labels;
- interrupt/cancel state for long-running actions.

## Guardrails

Avoid claiming:

- full OS replacement;
- universal agent control;
- permanent or unbreakable vault;
- everything stays local;
- formal fiduciary duty;
- secure memory across every app;
- complete cross-device continuity.

Safe current claim:

> Active Mirror is a browser-native reflective workspace that makes model use more inspectable through boundaries, route truth, generated viewports, and receipts.

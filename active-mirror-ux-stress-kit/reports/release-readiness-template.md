# Active Mirror UX Release Readiness Report

Date:
Reviewer:
Surface:
Build/commit:

## Verdict

- Status: PASS / BLOCKED / NEEDS FIXES
- Summary:

## Gate Scores

| Gate | Score 0-5 | Minimum | Status |
|---|---:|---:|---|
| Consent |  | 4 |  |
| Memory visibility |  | 4 |  |
| Context routing |  | 4 |  |
| Recovery |  | 3.5 |  |
| Accessibility/cognitive load |  | 4 |  |

## P0/P1 Findings

| ID | Severity | Screen/step | Risk | Required fix | Owner |
|---|---|---|---|---|---|

## Context Packet Evidence

- Can the user see context before a route?
- Can the user remove or redact context?
- Can the user force local-only?
- Does the receipt show included and excluded context?

## Consent Evidence

- Which irreversible actions were tested?
- Did every irreversible action require explicit approval?
- Was reversibility shown before approval?

## Memory Evidence

- Can the user inspect memory?
- Can the user edit, delete, scope, or export memory?
- Are stale, inferred, sensitive, and conflicting states visible?

## Local/Cloud Evidence

- Which route stayed local?
- Which route used a frontier model?
- Which external APIs were called?
- Was data leaving the device clearly labeled?

## Recovery Evidence

- Can long tasks be paused, canceled, or inspected?
- Can wrong context be removed and rerun?
- Are failures clear and recoverable?

## Release Decision

The release is not ready if any P0/P1 remains open or if the minimum gate scores are not met.

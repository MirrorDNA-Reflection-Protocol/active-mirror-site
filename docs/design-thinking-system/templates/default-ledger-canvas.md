# Default Ledger Canvas / v0

Use this to remember bounded defaults without turning memory into hidden assumptions.

## Purpose

Store "using your default" decisions visibly, with scope, expiry, and override.

## Ledger Entry

| Field | Value |
| --- | --- |
| Default name |  |
| Plain-language default |  |
| Why this exists |  |
| Scope | Global / project / session / tool / output type |
| Applies when |  |
| Does not apply when |  |
| Evidence |  |
| Sensitivity | Low / medium / high |
| Expiry |  |
| Override phrase |  |
| Owner |  |
| Last reviewed |  |

## User-Facing Disclosure

```text
Using your default: [default].
Change it for this turn?
```

## Promotion Gate

Promote only when:

- The user explicitly approves the default.
- The default has a bounded scope.
- The receipt states what changed.
- The user can override or delete it later.

## Failure Modes

- Default applied outside scope.
- Default silently replaces current intent.
- Default contains sensitive context.
- Default never expires.

## Receipt Fields

- Default checked.
- Default used or skipped.
- Override offered.
- Memory entry created, updated, or unchanged.

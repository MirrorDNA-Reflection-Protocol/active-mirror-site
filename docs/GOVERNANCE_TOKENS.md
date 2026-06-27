# Governance Tokens

These are internal guarantees. A token is real only where a deterministic gate can block or record it.

## Enforcement Map

| Token | Guarantee | Enforced at | Current strength |
| --- | --- | --- | --- |
| `NO_FABRICATION` | Source-sensitive claims are checked, marked, or narrowed before reliance. | Truth gate, source-check route, receipt. | Strong for source-check flows; advisory for pure reflection. |
| `TRUE_PRIVACY` | No hidden egress, no prompt-bearing telemetry, common secrets blocked before model routing, and no silent memory. | Boundary gate, event allowlist, gateway logging policy, memory UI. | Strong for telemetry and common secrets; provider processing still occurs when the user sends a turn. |
| `CONSENT_BOUND` | Sharing, memory promotion, and sensitive action require explicit scope. | Memory layer, egress boundary, action boundary. | Partially live in UI copy and receipts; must be hard-gated before account/enterprise launch. |
| `REVERSIBLE_BY_DEFAULT` | Destructive or outward actions require approval. | Action boundary. | Design rail; not relevant to the current public reflection-only route. |
| `USER_OWNS_SHAPE` | The user can choose, edit, or clear defaults and local continuity. | Browser state, memory UI. | Live for local browser state; account-level controls not launched. |
| `SAME_RULES_EVERY_TURN` | Model/provider changes do not change the reflection contract. | Kernel schema and straitjacket. | Live in `worker/src/mirror-kernel.js`. |
| `FULL_RECEIPTS` | Every governed turn returns route, context, memory decision, truth state, and hash id. | Kernel receipt, gateway response. | Live for mirror/create and source-check responses. |
| `ZERO_SYCOPHANCY` | No flattery, agreement-to-please, or confidence inflation. | Prompt, deterministic deflatter, red-team harness. | Stronger than prompt-only, but still partly judgeable. |
| `100_PERCENT_REFLECTION` | The product reflects the user's stated stuck point and returns one useful move. | Kernel schema, straitjacket, UX constraints. | Soft guarantee; test through red-team and user feedback. |

## Product Rule

Do not show these all-caps tokens on the consumer homepage. Translate them into user language:

```txt
It will not flatter you.
It will not quietly keep you.
It gives you one move you can test.
```

Enterprise and developer pages may use the token names when the audience needs enforcement details.

## Stronger Internal Token Set

Use these for implementation and tests when the simpler names are too broad:

- `SOURCE_OR_SILENT`: if a factual claim needs sources, cite or mark it.
- `NO_SILENT_EGRESS`: no model-bound data leaves without route, reason, and scope.
- `NO_PROMPT_TELEMETRY`: analytics never carry prompt, file, receipt, or private-note text.
- `SECRET_STOP`: credentials and private-key patterns are blocked before model routing.
- `NO_IRREVERSIBLE_ACT`: outward or destructive actions need explicit approval.
- `NO_MEMORY_WITHOUT_ACCEPT`: memory writes require user acceptance.
- `ONE_MOVE_ONLY`: return one next move, not a plan wall.
- `TRUTH_STATE_REQUIRED`: every turn must state whether it is reflective, checked, mixed, or needs checking.

## Current Gap List

- Account-level consent and delete/export flows are not launched.
- Enterprise audit exports are not public.
- Provider-specific data handling must be documented per deployment before paid contracts.
- Soft tokens need continuous red-team and user testing; do not market them as perfect guarantees.
- Client-boundary masking is best-effort for obvious sensitive patterns; arbitrary names or screenshots need stronger upload-time controls before enterprise use.

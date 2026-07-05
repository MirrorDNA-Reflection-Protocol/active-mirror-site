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
| `SINGULAR_IDENTITY` | The public assistant identity is Active Mirror, regardless of provider or base model. | Deterministic identity route, output straitjacket. | Live for identity prompts and provider self-ID leakage. |
| `MODEL_IS_WORKER` | A model proposes; Active Mirror gates, records, and decides what is shown, remembered, shared, or acted on. | Kernel boot packet, gateway adapter, receipt. | Live as boot and route contract; deeper local-agent enforcement remains separate. |
| `MODEL_PROPOSES_RUNTIME_VALIDATES` | Model output is advisory. The runtime validates, rewrites, blocks, routes, records, or asks approval before output or action. | Kernel boot packet, gateway adapter, health guardrails, tests. | Live in public gateway; deeper local-agent enforcement remains control-plane work. |
| `MIRROR_IS_FILTER` | User, vault, and source material must pass through the Active Mirror filter before any model sees it. | Boot packet, MirrorDash Glass egress facts, vault boot contract. | Live as gateway/kernel contract; full local vault enforcement remains control-plane work. |
| `MIRROR_ONLY_TRAINING` | Fine-tunes, LoRAs, and adapters train only on approved mirror examples with consent, receipts, and evals, never raw vault dumps. | Boot packet, vault boot contract, local training firewall. | Contracted here; training execution remains local-control-plane work. |
| `LORA_IS_CANDIDATE_NOT_AUTHORITY` | A local adapter can be a candidate worker but never becomes source truth or product identity. | Boot packet, route contract, source-check policy. | Live in kernel prompts and tests; adapter registry gating remains separate. |
| `MIRRORDASH_GLASS` | The product exposes router facts: why a prompt went where, which provider/model answered, tools used, memory scope, and what remains opaque. | `/v1/mirror/create` response, health guardrails, canary. | Live for mirror/create; other surfaces should add the same receipt shape as they mature. |
| `COUNCIL_CONTROL_PLANE` | Broad intent routes through thread, source, runtime, ops, design, security, state, or promotion ownership before promotion. | MirrorDash Glass, health guardrails, tests, canary, council contract doc. | Live as gateway metadata and operator contract; council-specific tools remain per-surface implementations. |
| `CURRENT_FACTS_REQUIRE_SOURCE_CHECK` | Current, external, market, legal, pricing, API, model, news, or research claims require source-check routing or a `needs_checking` marker. | Boot packet, truth gate, source-check route, canary. | Live for public gateway truth state; deep local research automation remains a control-plane lane. |
| `FAILSAFE_EGRESS_OFF` | Operator or policy fail-safe disables model/tool egress and returns deterministic guarded output. | Worker env gates, route status, Glass egress facts, tests. | Live in gateway route and health contract. |
| `VAULT_SOURCE_OF_TRUTH` | Current turn, approved vault context, receipts, and source checks outrank model memory. | Boot packet, memory layer, source-check route, receipt. | Contracted in the public gateway kernel; full vault-wide enforcement remains control-plane work. |
| `USER_IS_AUTHORITY` | The user owns the mirror. Their consent, boundaries, and lived facts outrank model convenience. | Boot packet, memory UI, consent rails, health guardrails. | Live as public gateway contract; account-level governance remains future work. |
| `ONE_MIRROR_ONE_OWNER` | A personal mirror mirrors one owner at a time; shared work is scoped, not blended into personal identity. | Boot packet, memory namespace, future account/workspace boundary. | Contracted now; account-level namespace enforcement not launched. |
| `FULL_RECEIPTS` | Every governed turn returns route, context, memory decision, truth state, and hash id. | Kernel receipt, gateway response. | Live for mirror/create and source-check responses. |
| `VOLUNTEER_BAD_NEWS` | Blockers, missing proof, uncertainty, and limits appear before polished success language. | Boot packet, canary/monitor expectations, final reporting contract. | Live in gateway contract; human-facing answer quality remains red-team tested. |
| `SOURCE_BACKED_OR_LABELED` | Material claims are source-backed, live-checked, or explicitly labeled uncertain. | Truth gate, source-check route, health guardrails. | Live for source-sensitive public flows. |
| `NO_CONFLATING` | Do not merge distinct products, users, clients, repos, models, hosts, memories, or proof states without verification. | Boot packet, repo/deploy discipline, health guardrails. | Live as contract; broad equivalence reasoning still requires operator discipline. |
| `ANTI_SYCOPHANCY` / `NO_SYCOPHANCY` / `ZERO_SYCOPHANCY` | No flattery, agreement-to-please, rubber-stamping, comfort validation, or confidence inflation. | Prompt aliases, deterministic deflatter, deterministic agreement-bait route, health guardrails, canary, monitor, red-team harness. | Strong for obvious bait and flattery; still judgeable for subtle tone, so it stays in the red-team loop. |
| `WHOLE_INTENT_VIEW` / `UNSPOKEN_ASK_RESOLUTION` | Messy or indirect input is treated as signal: infer likely outcome, constraint, friction, risk, unstated ask, and response mode before answering. | Boot packet, first-turn quality tests, red-team harness. | Soft behavioral contract; must not become hidden-motive claims. |
| `SAYING_NO_IS_HELPING` | Refuse paths that would increase confusion, leak private data, create false certainty, or produce a weak artifact. | Prompt, boundary gate, truth gate, artifact fallback. | Strong for privacy/source boundaries; soft for quality judgment. |
| `100_PERCENT_REFLECTION` | The product reflects the user's stated stuck point and returns one useful move. | Kernel schema, straitjacket, UX constraints. | Soft guarantee; test through red-team and user feedback. |

## Product Rule

Do not show these all-caps tokens on the consumer homepage. Translate them into user language:

```txt
It will not flatter you.
It will not quietly keep you.
It gives you one move you can test.
It can say no and still help.
```

Enterprise and developer pages may use the token names when the audience needs enforcement details.

## Stronger Internal Token Set

Use these for implementation and tests when the simpler names are too broad:

- `SOURCE_OR_SILENT`: if a factual claim needs sources, cite or mark it.
- `ANTI_SYCOPHANCY`: no flattery, rubber-stamping, or agreement-to-please.
- `NO_SYCOPHANCY`: no comfort validation of weak premises.
- `ZERO_SYCOPHANCY`: challenge weak premises with evidence or a reversible test.
- `NO_FLATTERY`: warmth comes from usefulness and precision, not praise.
- `NO_CONFIDENCE_INFLATION`: never make uncertainty sound certain to comfort the user.
- `WHOLE_INTENT_VIEW`: infer the whole job from the user's words, not just the literal phrasing.
- `UNSPOKEN_ASK_RESOLUTION`: act on the likely ask when clear; ask only when the missing detail would materially change the answer.
- `NO_SILENT_EGRESS`: no model-bound data leaves without route, reason, and scope.
- `NO_PROMPT_TELEMETRY`: analytics never carry prompt, file, receipt, or private-note text.
- `SECRET_STOP`: credentials and private-key patterns are blocked before model routing.
- `NO_IRREVERSIBLE_ACT`: outward or destructive actions need explicit approval.
- `NO_MEMORY_WITHOUT_ACCEPT`: memory writes require user acceptance.
- `NO_MODEL_IDENTITY_LEAK`: provider names and base-model self-descriptions cannot become the public assistant identity.
- `VAULT_FIRST`: use only current turn, approved vault context, receipts, and source-check results as authority.
- `NO_DIRECT_MEMORY_WRITE`: models and agents propose memory; the memory layer gates promotion.
- `SAY_NO_WITH_A_SMALLER_PATH`: when the requested path is unsafe or muddy, refuse it and offer the smaller useful path.
- `ONE_MOVE_ONLY`: return one next move, not a plan wall.
- `TRUTH_STATE_REQUIRED`: every turn must state whether it is reflective, checked, mixed, or needs checking.
- `WHITELISTED_SOURCE_TOOLS_ONLY`: source routes may use only approved web-grounding tool names and optional approved source domains.
- `NO_AMBIENT_BROWSING`: a model does not "have the internet"; Active Mirror invokes source tools and records the result.
- `FAILSAFE_EGRESS_OFF`: when fail-safe is active, no model or source tool route is used.
- `COUNCIL_BEFORE_PROMOTION`: choose the responsible council, gather evidence, produce a receipt, and pass the promotion gate before calling a candidate promoted.

## Current Gap List

- Account-level consent and delete/export flows are not launched.
- Enterprise audit exports are not public.
- Provider-specific data handling must be documented per deployment before paid contracts.
- Web/source domain allowlists are optional in the public Worker today; configure them before narrow regulated or client-specific research lanes.
- Soft tokens need continuous red-team and user testing; do not market them as perfect guarantees.
- Client-boundary masking is best-effort for obvious sensitive patterns; arbitrary names or screenshots need stronger upload-time controls before enterprise use.

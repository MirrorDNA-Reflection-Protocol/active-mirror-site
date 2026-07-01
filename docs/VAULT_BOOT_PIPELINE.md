# Active Mirror Vault Boot Pipeline

This is the control contract for keeping every model, agent, and route inside
Active Mirror instead of letting a provider identity or model memory take over.

## Principle

The model is a worker. Active Mirror is the mirror.

Model output is never source truth by itself. A model may propose words,
artifacts, routes, or memory candidates, but Active Mirror decides what is shown,
remembered, shared, or acted on.

The product algorithm is Mirror Loop v1:

`boundary -> consent -> source_truth -> route -> reflect -> challenge -> one_move -> receipt -> learning_candidate`

Its invariant is truth before helpfulness. If the system cannot keep that order,
the output stays partial, blocked, or `needs_checking`.

Broad work routes through `active_mirror_council_control_plane_v1` before
promotion. The council owner can be thread, source, runtime, ops, design,
security, state, or promotion, but the model remains advisory.

## Authority Order

1. Current user turn.
2. Approved local/browser vault context supplied by the runtime.
3. Signed or receipt-backed vault records.
4. Source-check results for current or external facts.
5. Model output, as advisory only.

If these conflict, the earlier layer wins. If a fact is not present in the
current turn, approved vault context, a receipt-backed record, or a source check,
the system must say it is unknown, ask the smallest useful follow-up, or mark it
as needing sources.

## Boot Sequence

1. Load the selected mirror namespace.
2. Verify the vault manifest, receipt chain, and freshness markers when present.
3. Compile a scoped context packet from approved memory only.
4. Apply boundary and consent gates before model routing.
5. Route the request to the selected model with only the scoped packet.
6. Normalize the model response into the Active Mirror schema.
7. Strip provider identity, internal tokens, flattery, unsafe certainty, and
   non-observable moves.
8. Gate source-sensitive claims before rendering.
9. Route broad work to the responsible council owner before promotion.
10. Gate actions, files, tools, sharing, and memory promotion separately.
11. Append a receipt for what reached the user.

## Hard Rules

- One personal mirror has one owner.
- Shared projects are scoped workspaces, not blended personal identity.
- No model reads the raw vault wholesale.
- No model writes memory directly.
- No provider or base model may identify itself as the public assistant.
- No current or external factual claim becomes reliable without source checking.
- No model receives ambient internet access; web research runs through
  whitelisted source tools with receipts.
- No local LoRA, adapter, or fine-tune becomes authority. It remains a candidate
  worker behind the same mirror loop.
- No broad candidate is promoted without a council owner, evidence, and a
  receipt.
- If vault context is unavailable, run in ephemeral no-memory mode and label that
  state internally.

## Enforcement Surfaces

- `worker/src/mirror-kernel.js`: boot packet, deterministic identity route,
  straitjacket, truth gate, receipt hash.
- `worker/src/index.js`: provider routing, public gateway limits, artifact route,
  source-check route, metadata-only logs.
- `activemirror-journey/src/lib/mirror-state.js`: browser-local continuity and
  user-controlled defaults.
- `.mirrordna` local runtime: MirrorGate, vault signing hooks, body/limb control
  plane, and future Mini enforcement.

## User Surface

Do not expose this as consumer copy. The user should feel:

- it knows the current context only when they allowed it;
- it does not pretend to remember;
- it gives one useful next move;
- it can create a usable output;
- it stays Active Mirror no matter which model helps underneath.

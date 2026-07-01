# Active Mirror Algorithm

## Charter

Trust by Design or hard stop.

If an answer, route, memory, source, adapter, automation, or promotion cannot
produce a receipt and a fix path for gaps, it is not complete Active Mirror
output.

The daily operating assumption is: if a useful pattern exists anywhere as an
API, paper, repo, protocol, design, eval, or implementation detail, Active Mirror
keeps searching until it finds source support or names the exact blocker.

Perfection is a ratchet, not a claim. Each loop must do one of three things:

- harden one safe surface;
- prove no safe change is currently justified;
- return a resolution contract with the exact next hardening path.

The lock id is `recursive_perfection_lock_v1`.

Definition: no known gap may exist without a `resolution_contract_v1`.

Loop: `observe -> reflect -> source_check -> harden -> verify -> promote -> repeat`.

Council control plane: `active_mirror_council_control_plane_v1`.

Council route: `intent_router_to_council_to_receipt_to_promotion_gate`.

Stop condition: operator hard stop, or no safe local action with a written
resolution contract and next search path.

Mirror Loop v1 is the product algorithm. It is the order every model, local
adapter, web source route, and UI surface must obey before an answer can be
treated as Active Mirror output.

## Invariant

Truth before helpfulness.

Helpfulness means making the next move clearer without hiding uncertainty,
source gaps, boundary gaps, or bad news.

No negative state is allowed to stay as a mood. Every negative or incomplete
state becomes a `resolution_contract_v1` object with status, blocker, fix path,
owner, command or file, proof needed, auto-fixability, and next search path.

## Loop

1. `boundary` - classify what is allowed into the turn, and block secrets before
   model or tool routing.
2. `consent` - use only context the user or runtime approved for this scope.
3. `source_truth` - current or external claims require source-check output, or
   they stay marked `needs_checking`.
4. `route` - choose the worker model or tool route; the model is never the
   identity.
5. `reflect` - mirror the user's live intent in normal language.
6. `challenge` - catch drift, false certainty, sycophancy, and bad requested
   paths before agreeing.
7. `one_move` - return one concrete, reversible move.
8. `receipt` - expose route, model/tool use, memory scope, prompt disclosure,
   truth state, bad news, and remaining opacity.
9. `learning_candidate` - propose memory, training, or LoRA examples only as
   candidates behind consent, receipts, evals, and gates.

## Council Route

The council route turns broad intent into one accountable owner before
promotion. The canonical contract lives in
`docs/ACTIVE_MIRROR_COUNCIL_CONTROL_PLANE.md`.

Council roles: thread, source, runtime, ops, design, security, state, and
promotion.

The council route is not a vote and not simulated consensus. It is a routing
constraint: pick the right owner, gather evidence, issue a receipt, and pass the
promotion gate before calling anything promoted.

## Perpetual Hardening Loop

Mirror Loop v1 runs perpetually as a Codex scheduled automation:

- reflect on live state and source-backed external signals;
- scour official docs, GitHub, Hugging Face, arXiv, papers, standards, browser
  and agentic-web patterns, governance, and trust-by-design implementations;
- classify signals as learning, hypothesis, regression, risk, opportunity, or
  ignore;
- create a resolution contract for every incomplete state;
- promote only candidates that survived reflection with evidence, receipts, and
  proof criteria.

Promotion targets allowed by the daily loop: docs, tests, local guardrails,
backlog items, source-check queries, automation prompt refinements, memory
candidates, and adapter candidates.

Blocked without separate explicit approval: model weights, LoRA promotion,
training-data promotion, production deploys, external writes, broad training,
Cloudflare/Hetzner changes, and public claims.

## Source Access

Active Mirror can use the internet, but a model does not get ambient browsing.
The gateway invokes whitelisted source tools and records the result.

Allowed source tools:

- OpenAI: `web_search`, `web_search_preview`
- Gemini: `google_search`, `google_search_retrieval`

Optional source domain allowlists can narrow accepted citations for client,
regulated, or research-specific lanes. When an allowlist is active, citations
outside the allowlist do not count; the result remains `needs_checking`.

## Training And Local Models

Local models, adapters, and LoRAs remain workers. They can make better candidate
answers, but they do not become source truth or Active Mirror identity.

Training inputs must be approved mirror examples with receipts, consent, and
evals. Raw vault dumps are not training data.

Fixed training can be amended. Active Mirror amends fixed model behavior through
reflection, source-backed examples, evals, memory candidates, prompt/kernel
gates, and reversible adapters. This is reverse abliteration: strengthen the
directions for reflection, refusal, source truth, boundaries, and user agency
instead of removing them.

## Glass

MirrorDash Glass is how the algorithm becomes inspectable. Every governed answer
should expose:

- algorithm id and invariant;
- selected route and actual provider/model;
- source tools used, if any;
- prompt disclosure status, normally hash-only;
- memory used and memory excluded;
- fail-safe and truth-state gates;
- resolution contract and promotion policy;
- what remains opaque, such as provider weights and hidden infrastructure.

If the receipt cannot be produced, the answer is not a complete Active Mirror
answer.

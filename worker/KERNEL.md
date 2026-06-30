# Active Mirror — Kernel Contract (v1)

The kernel is the **governance layer** for honest reflection. It sits between any
model and the user and is the only thing that decides what reaches them. Build the
UI against *this contract*, not against the source — the interface below is frozen.

- Source: `worker/src/mirror-kernel.js` (pure, model-agnostic, Web-Crypto only).
- Runtime adapter (calls the configured hosted reflection/media routes): `worker/src/index.js`.
- Live endpoint: **`https://gateway.activemirror.ai`** (Cloudflare Worker).
- Tests (must stay green): `npm run worker:test`
  (`worker/test/mirror-kernel.test.mjs` plus gateway guardrail tests).

---

## Boot Packet

Every provider route receives the same versioned Active Mirror boot packet before
the user turn. The current boot id is:

```text
2026-06-30-active-mirror-boot-v6
```

The boot packet is steering, not enforcement. It tells the model to:

- reflect one stuck point, not impress, entertain, diagnose, or decide;
- enforce anti-sycophancy in generation;
- use only the submitted turn plus the selected boundary;
- prefer reflection before prediction;
- return one small reversible move;
- avoid implying memory without explicit approval;
- mark current or external factual claims instead of sounding certain;
- narrow "do everything / what else" turns to the next smallest useful slice;
- produce only the smallest useful artifact shape when the user asks for code,
  markdown, a PDF, or a sendable output;
- answer "who are you / what can you do" plainly and move the user back to one useful action;
- avoid therapy, professor, brand-strategy, and internal-evaluator voice;
- challenge the idea, plan, or next move without attacking the person;
- avoid meta-analysis openings such as "you are treating", "the loop is", "the real question is", or "what I hear is";
- avoid inverted, mystical, guru-like, or riddle-like phrasing;
- avoid abstract helper language such as "frame", "bounded", "label", "limits",
  "realer", "useful tension", "one stuck point", and "productive pause" unless the user used those words first;
- keep consumer-facing output free of internal token names.

The deterministic gates below remain the guarantee. If a provider leaks internal
rails such as `ZERO_SYCOPHANCY` or `ONE_MOVE_ONLY`, the straitjacket strips them
before the user sees the answer and records `"internal_tokens_removed"`.

---

## HTTP API

### `POST /v1/mirror/create`

**Request body** (JSON):

| field | type | required | notes |
|---|---|---|---|
| `intent` | string | yes | the one thing the user is stuck on. **12–1000 chars** (enforce the 12 min client-side; shorter throws). |
| `boundary` | string | no | `"personal"` (default) · `"client"` · `"secrets"` · `"drafts"`. Controls declared exclusions and, for `client`, best-effort masking before model/source-check routing. |
| `route` | string | no | `"reflection"` (use this) · `"chat"` · `"media"` · `"auto"` (default). |
| `turn` | integer | no | 1–9999, default 1. Increment per turn in a session. |

**Request header** (recommended):

| header | notes |
|---|---|
| `X-Active-Mirror-Session` | Browser-session random id, not user identity. Used only for public gateway budget/rate protection. |

**Success response** `200`:

```json
{
  "ok": true,
  "fallback": false,
  "receipt_id": "ae80bdb39151b7e8d529569d",
  "mirror": {
    "reflection": "string — 2–3 sentences, names the real thing under their question",
    "question": "string — the sharper question; ALWAYS ends with '?'",
    "move": "string — one small concrete thing; never a list",
    "visual": null,
    "receipt": {
      "why": "string",
      "context_used": "string",
      "context_excluded": "string",
      "route": "string",
      "memory_decision": "string"
    }
  },
  "truth_state": {
    "status": "reflective",
    "checked": false,
    "label": "Reflective, not source-checked.",
    "reason": "No current or external factual claim was detected in the visible mirror.",
    "signals": []
  },
  "straitjacket": [],
  "route": {
    "capability": "reflection",
    "label": "reflection help",
    "primary": "bridge",
    "provider": "bridge",
    "upstream_host": "bridge.activemirror.ai",
    "fallback": null
  }
}
```

- `receipt_id` — 24 hex chars (SHA-256 of the returned mirror + truth marker + turn).
- `fallback` — `true` if a backup route/model was used (still a valid mirror).
- `route.primary` — the configured first-choice provider family for that capability.
- `route.provider` — the provider family that actually returned the visible mirror.
- `route.upstream_host` — only present for the bridge route, and only contains the non-secret host used by the Worker.
- `truth_state` — deterministic source-sensitivity marker. It does not fact-check; it tells the UI whether the turn is reflective only or needs sources before reliance.
- `straitjacket` — array of deterministic corrections applied this turn. Possible values:
  `"flattery_removed"`, `"canned_phrase_removed"`, `"internal_tokens_removed"`, `"tone_guard_applied"`, `"question_forced"`, `"move_made_singular"`, `"visual_dropped"`, `"truth_state_needs_sources"`, `"deterministic_identity"`.
  `"client_boundary_redacted"` appears when obvious client-boundary sensitive patterns were masked before model routing.
  `"professional_redirect"` appears when medical, legal, financial, or regulatory-risk advice was framed before model routing.
  `"deterministic_identity"` appears when product identity prompts such as "who are you?" or "what can you do?" are answered by the stable kernel path instead of a provider.
  (Empty array = the model stayed inside the cage on its own.)

### `truth_state` — the hallucination rail

The kernel marks source-sensitive language after the model is caged and before the
receipt is minted. This is not a substitute for web research or citations.

| `status` | meaning | UI copy |
|---|---|---|
| `reflective` | no current or external factual claim was detected in the visible mirror | `Reflective, not source-checked.` |
| `needs_checking` | current, external, numeric, or high-certainty factual language was detected | `Needs sources before you rely on it.` |
| `checked` | reserved for a future route that supplies source verification | `Source checked.` |

When `status` is `needs_checking`, `straitjacket` includes
`"truth_state_needs_sources"`. The UI should render this quietly as a trust signal,
not as a large workflow.

### `POST /v1/mirror/source-check`

Runs a bounded source-backed check for a turn already marked `needs_checking`.
Provider keys stay in the Worker. The browser sends only the current intent,
question, and next move.
For `boundary: "client"`, obvious emails, URLs, phone numbers, account-like IDs,
and money terms are masked before the source-check provider route.

**Request body**:

```json
{
  "intent": "What are the latest GenUI competitors today, and who is winning?",
  "question": "Which current sources define the GenUI competitor set?",
  "move": "Check current sources before using this claim.",
  "boundary": "personal"
}
```

**Success response** `200`:

```json
{
  "ok": true,
  "receipt_id": "24-hex",
  "truth_state": { "status": "checked", "checked": true, "label": "Source checked." },
  "research": {
    "verdict": "supported",
    "answer": "short answer",
    "changes": "what this changes for the next move",
    "source_quality": { "best_score": 95, "high_quality_count": 1, "weak_count": 0, "count": 2 },
    "sources": [{
      "title": "source title",
      "url": "https://...",
      "quality": "primary_docs",
      "quality_label": "Primary docs",
      "quality_score": 95,
      "quality_reason": "Official developer or documentation source."
    }]
  }
}
```

The endpoint returns `checked` only when at least one `http(s)` source URL survives
cleaning. Otherwise it returns a non-`200` response and the UI keeps the turn in
`needs_checking`.

`research.verdict` is one of:

| verdict | meaning |
|---|---|
| `supported` | sources directly support the narrow claim being checked |
| `mixed` | sources exist, but the evidence is ambiguous, incomplete, or split |
| `not_enough` | the check found sources, but not enough reliable evidence to rely on the claim |

Each source also carries a deterministic quality tier:

| quality | score band | meaning |
|---|---:|---|
| `primary_docs` | 95 | official developer, docs, API, or reference source |
| `official_source` | 90 | official product or company source |
| `credible_analysis` | 82 | research, standards, academic, or public institution source |
| `secondary_source` | 65 | general web context, not primary proof |
| `listicle_or_vendor` | 55 | review, comparison, alternatives, or vendor-adjacent page |
| `weak_source` | 35 | social, forum, or personal publishing source |

Sources are returned in descending `quality_score` order before the five-source
cap is applied. Equal-score sources keep provider order.

### `mirror.visual` — the governed GenUI object

`visual` is **`null`** OR an object the UI renders inline. It is gated: off-registry kinds,
empty slots, and markdown are dropped before it ever reaches you. You can trust it.

```json
{ "kind": "reframe", "left": "string", "right": "string", "note": "string" }
```

| `kind` | meaning | render as |
|---|---|---|
| `reframe` | `left` = the framing they brought; `right` = the realer question | a pivot: left (faded/struck) → right (emphasized) |
| `axes` | `left`/`right` = the two competing forces in tension | two poles with a divider; `note` = caption |
| `spectrum` | `left`/`right` = the two poles of a false either/or | a horizontal range/bar between the two poles |

`note` may be `""`. Slots are ≤120 chars, plain ASCII (already sanitized).
If `visual` is `null`, render nothing — most turns have no visual.

### Boundary semantics (`boundary` field)

| value | what the receipt declares excluded |
|---|---|
| `personal` | stored personal history stays out unless approved; only the submitted turn is used |
| `client` | extra client context stays out; obvious emails, URLs, phone numbers, account-like IDs, and money terms are masked before model/source-check routing |
| `secrets` | keys, tokens, credentials, private URLs, operational secrets |
| `drafts` | loose drafts, half-formed claims, speculative positioning (temporary) |

### Errors

- **Secret detected in `intent`** → `400`:
  ```json
  { "ok": false, "error": "boundary_violation", "receipt": { "...": "nothing was sent to any model" } }
  ```
  The model is **never called** when a secret is detected. UI copy: hold the turn, send nothing.
- **Professional-risk request detected in `intent`** → `200` with a redirect mirror:
  the model is **not called** for medical, legal, financial, or regulatory advice.
  `truth_state.status` is `needs_checking`, `straitjacket` includes
  `"professional_redirect"`, and the move routes to a qualified person/source.
- **`intent` < 12 chars or malformed body** → `400 { "ok": false, "error": "intent_too_short" }` or `400 { "ok": false, "error": "invalid_json" }`.
  Prevent this client-side (require ≥12 chars before POST).
- **Payload over gateway cap** → `413`:
  ```json
  { "ok": false, "error": "payload_too_large" }
  ```
- **Rate/budget guardrail** → `429`:
  ```json
  { "ok": false, "error": "rate_limited", "scope": "session_daily", "retry_after": 3600 }
  ```
  `scope` can be `session`, `network`, `session_daily`, `network_daily`,
  `event_session`, or `event_network`. UI copy: say the mirror route is cooling
  down and invite the user to try again shortly.

### Public cost/abuse rails

The public gateway enforces layered limits before provider calls:

| rail | default |
|---|---:|
| mirror/source-check payload cap | 16 KB |
| privacy event payload cap | 2 KB |
| mirror session minute window | 12 turns / 60s |
| mirror network minute window | 36 turns / 60s |
| mirror session daily budget | 80 turns / UTC day |
| mirror network daily budget | 500 turns / UTC day |
| event session minute window | 90 events / 60s |
| event network minute window | 240 events / 60s |

Daily budget counters reset at UTC midnight. These are public-edge protection
limits, not user identity or billing records.

### CORS — allowed origins

`https://activemirror.ai`, `https://www.activemirror.ai`,
`https://id.activemirror.ai`,
`https://mirrordna-reflection-protocol.github.io`,
and for local dev: `localhost`/`127.0.0.1` on ports **5173, 5180, 4173, 8976**.
Use one of those ports locally or the gateway will reject the call.
Allowed request headers: `Content-Type`, `X-Active-Mirror-Session`.

### `POST /v1/events`

Privacy-safe frontend event rail. This endpoint is for coarse product health only.
It accepts allowlisted event names and route/status metadata, then rejects arbitrary
content fields. **Never send prompt text, file names, user notes, or receipt bodies.**

Allowed event names: `home_view`, `mirror_view`, `starter_clicked`,
`followup_clicked`, `mirror_submit`, `mirror_result`, `gateway_error`,
`ecosystem_result`, `cta_clicked`.

Allowed metadata fields: `page`, `surface`, `source`, `route`, `status`,
`fallback`, `visualKind`, `turn`, `target`, plus the generated session id and
timestamp. Event payloads are capped at 2 KB by default.

### `POST /v1/mirror/proof-sprint`

Metadata-only enterprise contact checkpoint for the public proof-sprint CTA.
This is **not** a workflow intake and must not receive private workflow content,
files, client names, notes, or prompts. The browser prepares the actual outbound
email locally after the gateway returns a receipt.

**Request body**:

```json
{
  "reply_to": "person@example.com",
  "workflow": "research",
  "timeline": "72h",
  "source": "hero",
  "consent": true,
  "website": ""
}
```

Allowed enum values:

| field | values |
|---|---|
| `workflow` | `research` · `approval` · `ops` · `unsure` |
| `timeline` | `72h` · `this_week` · `exploring` |
| `source` | `hero` · `final` |

`website` is a honeypot. If it is filled, the endpoint accepts quietly without
logging a contact request.

**Success response** `202`:

```json
{
  "ok": true,
  "type": "proof_sprint_request",
  "status": "received",
  "request_id": "psr_16hex...",
  "receipt_id": "24hex...",
  "policy": "metadata-only-contact",
  "next": "Request receipt created. Send the prepared email to start; do not include workflow content until a scoped intake is agreed."
}
```

The response includes `X-Active-Mirror-Event-Policy: metadata-only-contact`.
Safe logs include only request id, workflow enum, timeline enum, source enum,
reply email domain, and timestamp. The full email address is not written to logs.

---

## Guarantees (deterministic — do not weaken)

1. **Shape** — `reflection`, `question`, `move`, `receipt` are always present (schema-forced;
   safe deterministic fallback if the model fails). `visual` is `null` or a valid object.
2. **Honesty floor** — flattery and common canned helper phrases stripped; `question`
   always ends with `?`; `move` is one thing (lists collapsed to the first item).
3. **Privacy** — secrets in `intent` are blocked before any model runs.
4. **Source honesty** — source-sensitive claims are marked `needs_checking` unless a route explicitly verifies them.
5. **Record** — `receipt_id` is a content hash of exactly what was returned.
6. **GenUI cage** — `visual` is whitelisted (`reframe`/`axes`/`spectrum` only), markdown-stripped,
   non-empty slots, or it's dropped to `null`.
7. **Identity stability** — product identity prompts are answered by the deterministic kernel path,
   not by an improvised provider response.

The model is the brain you plug in; these guarantees are the kernel's, not the model's.

---

## Real example (verified live, hosted route)

Request:
```json
{ "intent": "Either I commit fully to this startup or I give up and get a real job. I keep flip-flopping.",
  "boundary": "personal", "route": "reflection", "turn": 1 }
```
Response `mirror`:
```json
{
  "reflection": "This sounds like a decision without a clear threshold. The useful signal is what evidence would make staying or leaving honest.",
  "question": "What specific result or signal would make you trust that continuing is earned, not just hoped for?",
  "move": "Write one measurable 30-day threshold for the startup, and decide in advance what each outcome would mean.",
  "visual": { "kind": "reframe", "left": "Am I a founder or should I get a real job?", "right": "What evidence would make either choice honest?", "note": "" },
  "receipt": { "why": "...", "context_used": "...", "context_excluded": "...", "route": "...", "memory_decision": "..." }
}
```

---

## Embedding the kernel directly (optional, non-HTTP)

```js
import { reflect } from "./mirror-kernel.js";
// callModel(prompt, schema) => { mirror, fallback, routeText }  (mirror may be null)
const out = await reflect({ intent, boundary: "personal", turn: 1, callModel });
// out = { ok, fallback, receipt_id, mirror, truth_state, straitjacket }
```
Web Crypto (`crypto.subtle`) must be global (it is in Workers, browsers, Node 18+).

---

## Stability

This is the v1 contract with one additive `truth_state` field. The shape
(`mirror.{reflection,question,move,visual,receipt}`, `truth_state`, `straitjacket[]`,
the visual registry) is **frozen** — build against it. Adding a new `visual.kind` or
`truth_state.status` is the only expected forward change, and the UI must ignore
unknown kinds/statuses rather than break.

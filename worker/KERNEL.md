# Active Mirror — Kernel Contract (v1)

The kernel is the **governance layer** for honest reflection. It sits between any
model and the user and is the only thing that decides what reaches them. Build the
UI against *this contract*, not against the source — the interface below is frozen.

- Source: `worker/src/mirror-kernel.js` (pure, model-agnostic, Web-Crypto only).
- Runtime adapter (calls the configured hosted reflection/media routes): `worker/src/index.js`.
- Live endpoint: **`https://gateway.activemirror.ai`** (Cloudflare Worker).
- Tests (must stay green): `worker/test/mirror-kernel.test.mjs` (11/11).

---

## HTTP API

### `POST /v1/mirror/create`

**Request body** (JSON):

| field | type | required | notes |
|---|---|---|---|
| `intent` | string | yes | the one thing the user is stuck on. **12–1000 chars** (enforce the 12 min client-side; shorter throws). |
| `boundary` | string | no | `"personal"` (default) · `"client"` · `"secrets"` · `"drafts"`. Controls what's declared excluded. |
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
  "route": { "capability": "reflection", "label": "reflection help", "fallback": null }
}
```

- `receipt_id` — 24 hex chars (SHA-256 of the returned mirror + truth marker + turn).
- `fallback` — `true` if a backup route/model was used (still a valid mirror).
- `truth_state` — deterministic source-sensitivity marker. It does not fact-check; it tells the UI whether the turn is reflective only or needs sources before reliance.
- `straitjacket` — array of deterministic corrections applied this turn. Possible values:
  `"flattery_removed"`, `"question_forced"`, `"move_made_singular"`, `"visual_dropped"`, `"truth_state_needs_sources"`.
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
| `personal` | personal history, sensitive emotion, private identity context |
| `client` | client names, partner details, commercial terms, confidential screenshots |
| `secrets` | keys, tokens, credentials, private URLs, operational secrets |
| `drafts` | loose drafts, half-formed claims, speculative positioning (temporary) |

### Errors

- **Secret detected in `intent`** → `400`:
  ```json
  { "ok": false, "error": "boundary_violation", "receipt": { "...": "nothing was sent to any model" } }
  ```
  The model is **never called** when a secret is detected. UI copy: hold the turn, send nothing.
- **`intent` < 12 chars or malformed body** → `500 { "ok": false, "error": "mirror_gateway_error" }`.
  Prevent this client-side (require ≥12 chars before POST).
- **Rate/budget guardrail** → `429`:
  ```json
  { "ok": false, "error": "rate_limited", "scope": "session", "retry_after": 60 }
  ```
  UI copy: say the mirror route is cooling down and invite the user to try again shortly.

### CORS — allowed origins

`https://activemirror.ai`, `https://www.activemirror.ai`,
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

---

## Guarantees (deterministic — do not weaken)

1. **Shape** — `reflection`, `question`, `move`, `receipt` are always present (schema-forced;
   safe deterministic fallback if the model fails). `visual` is `null` or a valid object.
2. **Honesty floor** — flattery phrases stripped; `question` always ends with `?`; `move`
   is one thing (lists collapsed to the first item).
3. **Privacy** — secrets in `intent` are blocked before any model runs.
4. **Source honesty** — source-sensitive claims are marked `needs_checking` unless a route explicitly verifies them.
5. **Record** — `receipt_id` is a content hash of exactly what was returned.
6. **GenUI cage** — `visual` is whitelisted (`reframe`/`axes`/`spectrum` only), markdown-stripped,
   non-empty slots, or it's dropped to `null`.

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
  "reflection": "You are treating this like a character test: all-in founder or responsible adult. The flip-flopping may be less about courage and more about not having a clear threshold for what evidence would make staying or leaving honest.",
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

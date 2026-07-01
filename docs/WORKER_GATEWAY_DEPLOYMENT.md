# Worker Gateway Deployment

Date: 2026-06-22

The Active Mirror model gateway lives in `worker/`.

## Current State

- Worker config includes the Cloudflare account ID.
- `gateway.activemirror.ai` is live and reports `active-mirror-site-gateway`.
- Use `env -u CLOUDFLARE_API_TOKEN npm run worker:deploy` when local OAuth is valid but an old shell token returns Cloudflare authentication errors.
- Reflection and critique routes use the approved text route.
- Media route uses the approved media route.
- Public visible identity remains Active Mirror. Machine-readable MirrorDash
  Glass exposes the actual provider/model/tool route, prompt disclosure posture,
  memory scope, fail-safe state, and `mirror_loop_v1` algorithm id.
- MirrorDash Glass and `/health` expose
  `active_mirror_council_control_plane_v1`, the thread/source/runtime/ops/design/
  security/state/promotion route before `reflection_promotion_v1`.
- Source-check routes use whitelisted web-grounding tools only. Optional source
  domain allowlists can narrow accepted citations.

## Required Cloudflare Permission

Use a Cloudflare API token scoped to account `c67a8591dff0a1b3681da50540530fc3` with Workers script/service write permission. If routing the Worker to a custom hostname later, include the relevant zone route/DNS permissions for `activemirror.ai`.

## Deploy Flow

```sh
npm run worker:deploy
```

After deploy:

```sh
npm run canary:prod
npm run monitor:gateway
```

Monitoring details live in `docs/GATEWAY_MONITORING.md`.

If using a token directly:

```sh
CLOUDFLARE_API_TOKEN=<workers-write-token> npm run worker:deploy
```

If using OAuth:

```sh
env -u CLOUDFLARE_API_TOKEN npx wrangler login --callback-host=127.0.0.1
npm run worker:deploy
```

## Secrets

Configure provider keys as Worker secrets, not browser variables:

```sh
npx wrangler secret put OPENAI_API_KEY --config worker/wrangler.jsonc
npx wrangler secret put GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER --config worker/wrangler.jsonc
```

Provider keys may exist locally in Keychain/MirrorDNA stores, but they must be pushed to Cloudflare as Worker secrets. Do not commit provider keys or expose them in browser JavaScript.

## Fail-Safe And Source Policy

Set any of these Worker env flags to disable model/tool egress and return
deterministic guarded output:

```sh
ACTIVE_MIRROR_FAILSAFE=1
MIRROR_GATEWAY_FAILSAFE=1
MIRROR_MODEL_EGRESS_DISABLED=1
ACTIVE_MIRROR_FAILSAFE_REASON=operator_or_policy_failsafe
```

Source checks can optionally be narrowed:

```sh
ACTIVE_MIRROR_SOURCE_DOMAIN_ALLOWLIST=arxiv.org,openai.com,ai.google.dev
ACTIVE_MIRROR_SOURCE_CACHE_ONLY=1
```

The Worker ignores configured source tool names outside the built-in allowlist:
OpenAI `web_search`, `web_search_preview`; Gemini `google_search`,
`google_search_retrieval`.

# Worker Gateway Deployment

Date: 2026-06-22

The Active Mirror model gateway lives in `worker/`.

## Current State

- Worker config includes the Cloudflare account ID.
- `gateway.activemirror.ai` is live and reports `active-mirror-site-gateway`.
- Use `env -u CLOUDFLARE_API_TOKEN npm run worker:deploy` when local OAuth is valid but an old shell token returns Cloudflare authentication errors.
- Reflection and critique routes use the approved text route.
- Media route uses the approved media route.
- Public responses expose capability labels and receipt status, not provider or model names.

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

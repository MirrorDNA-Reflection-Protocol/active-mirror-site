# Worker Gateway Deployment

Date: 2026-06-21

The Active Mirror model gateway lives in `worker/`.

## Current State

- Worker config includes the Cloudflare account ID.
- `npx wrangler deploy --config worker/wrangler.jsonc --dry-run` passes.
- Live deploy is blocked until Cloudflare auth has Workers write permission.
- Local Cloudflare tokens found on 2026-06-21 verified successfully, but both returned `Authentication error` for Worker service endpoints.
- `wrangler login` must complete in the browser, or a new API token must be provided with Workers permissions.

## Required Cloudflare Permission

Use a Cloudflare API token scoped to account `c67a8591dff0a1b3681da50540530fc3` with Workers script/service write permission. If routing the Worker to a custom hostname later, include the relevant zone route/DNS permissions for `activemirror.ai`.

## Deploy Flow

```sh
npm run worker:deploy
```

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
npx wrangler secret put ANTHROPIC_API_KEY --config worker/wrangler.jsonc
npx wrangler secret put GEMINI_API_KEY_ACTIVE_MIRROR_BROWSER --config worker/wrangler.jsonc
```

Provider keys already exist locally in Keychain/MirrorDNA stores, but they must be pushed to Cloudflare after Workers-write auth is available.

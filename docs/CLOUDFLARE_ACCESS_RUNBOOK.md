# Cloudflare Access Runbook

This repo must not depend on raw `npx wrangler` commands when local shell
environment tokens may be stale.

## Default Command Path

Use the repo wrapper:

```bash
npm run cf:whoami
npm run cf:r2:list
npm run cf:kv:list
npm run worker:deploy
npm run site:worker:deploy
```

The wrapper is `scripts/cloudflare-wrangler.mjs`.

It does three things before calling Wrangler:

- removes stale `CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN`, `CLOUDFLARE_EMAIL`, and
  `CLOUDFLARE_API_KEY`
- sets `CLOUDFLARE_ACCOUNT_ID=c67a8591dff0a1b3681da50540530fc3`
- uses the valid Wrangler OAuth session by default

## Optional Keychain Token

If a scoped Cloudflare token is installed later, run with:

```bash
ACTIVE_MIRROR_CF_KEYCHAIN=1 npm run cf:whoami
```

Expected Keychain item:

```text
service: active-mirror-cloudflare-api-token
account: codex
```

Do not commit Cloudflare API tokens. Do not print token values in logs.

## Required Permissions

Minimum token scope for this repo:

- Account read
- Workers Scripts edit
- Workers Routes edit
- Pages edit
- R2 Storage edit

If R2 commands fail with:

```text
Please enable R2 through the Cloudflare Dashboard. [code: 10042]
```

that is not a Wrangler command issue. The Cloudflare account must enable the R2
subscription in the dashboard before buckets can be created or bound.

## Current R2 Target

```text
bucket: active-mirror-media
binding: MIRROR_MEDIA_BUCKET
secret: MIRROR_MEDIA_SIGNING_SECRET
```

## No-Card Media Fallback

If R2 cannot be enabled because the account has no payment card, use Workers KV
as the durable free-tier fallback for small generated images.

```text
namespace: active-mirror-media
binding: MIRROR_MEDIA_KV
id: 2c46cd5ffaa44e06b7e25a6f1d5cb154
```

Storage priority:

```text
R2 private bucket -> Workers KV -> short-lived edge cache
```

KV is a practical fallback, not a full R2 replacement. Keep generated images
small and keep the signed URL TTL bounded.

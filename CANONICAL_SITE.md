# Active Mirror Deploy + Gateway Repo

This repo is the deploy surface for `activemirror.ai` and the source for the
Cloudflare gateway at `gateway.activemirror.ai`.

## Role

- `public/app/` contains the built app bundle copied from
  `/Users/mirror-pro/repos/activemirror-journey/dist/`.
- `worker/` contains the live gateway and the frozen mirror kernel contract.
- Root static files support the deployed site wrapper and redirects.
- `prototypes/` and older local copies are reference material unless promoted
  deliberately.

## Source Of Truth Split

- Product UI source: `/Users/mirror-pro/repos/activemirror-journey`.
- Deploy bundle target: `/Users/mirror-pro/repos/active-mirror-site/public/app`.
- Gateway/kernel: `/Users/mirror-pro/repos/active-mirror-site/worker`.

Do not edit `public/app/assets/*.js` by hand. Rebuild the source app and copy
the generated bundle.

## Guardrails

- Public UI must not name private provider/model routing unless Paul approves it.
- Frontend events must not include prompt text, file names, notes, receipts, or
  private user content.
- Remote frontend event sending is enabled only in the production app bundle
  built by `/Users/mirror-pro/repos/activemirror-journey` with
  `npm run build:deploy`. The Worker `/v1/events` endpoint must be live first.
- Gateway secrets stay in Cloudflare Worker secrets, not in source or config.
- The current hard cost guardrails are bounded payloads, allowed origins, route
  validation, provider timeouts, and no-store responses. True per-user rate
  limits require a Cloudflare binding or platform rule and must not be faked with
  module-level Worker state.

## Standard Check

Run before pushing deploy changes:

```bash
npm run build
npm run copy:audit
```

Run Worker checks before gateway deploys:

```bash
node worker/test/mirror-kernel.test.mjs
npx wrangler deploy --dry-run --config worker/wrangler.jsonc
```

Use `npm run worker:deploy` for the live gateway deploy. The script deliberately
unsets stale Cloudflare token environment variables so Wrangler uses the current
OAuth login with Workers write permission.

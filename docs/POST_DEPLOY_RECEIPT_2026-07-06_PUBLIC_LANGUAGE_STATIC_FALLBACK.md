# Post-Deploy Receipt: Public Language Cleanup + Static Fallback

Date: 2026-07-06
Repo: `/Users/mirror-pro/repos/active-mirror-site`
Related source repo: `/Users/mirror-pro/repos/activemirror-journey`

## What Changed

- Packaged the cleaned Active Mirror app from `activemirror-journey/dist` into `public/app`.
- Added `wrangler.site.jsonc` for a Cloudflare Workers static-assets fallback.
- Added reproducible scripts:
  - `npm run site:worker:dry`
  - `npm run site:worker:deploy`

## Why

GitHub Pages built and uploaded the artifact for the cleaned app, but failed at
the final Pages promotion step with `Deployment failed, try again later`.

A manual rerun of the failed job created duplicate `github-pages` artifacts in
that run, so the safe route was a fresh run. A fresh run also failed at the
final Pages deployment step. Build, canonical guard, copy audit, and artifact
upload were already passing.

The public domain needed to move now, so the app was deployed through
Cloudflare Workers static assets while leaving the existing gateway Worker
untouched.

## Live Version

- Static site Worker: `active-mirror-static-site`
- Worker version: `a9fb18b3-104e-4783-ba18-dbc12f9c8f1d`
- Routes:
  - `activemirror.ai/*`
  - `www.activemirror.ai/*`
- Live app bundle:
  - `/app/assets/index-BtJ_BlYl.js`
  - `/app/assets/index-Dnzmzsdl.css`

## Verification

Commands run:

```sh
npm run copy:audit
npm run guard:canonical
npm run build
ACTIVE_MIRROR_BASE_URL=http://127.0.0.1:4194/app npm run smoke:browser
npm run site:worker:dry
npm run site:worker:deploy
ACTIVE_MIRROR_BASE_URL=https://activemirror.ai/app npm run smoke:browser
npm run canary:prod
```

Observed results:

- Deploy source build passed.
- Deploy repo build passed.
- Public copy audit passed.
- Canonical deploy guard passed.
- Local built-preview browser smoke passed across mobile and desktop routes.
- Cloudflare Workers static-assets dry-run passed.
- Cloudflare Workers static-assets deploy succeeded.
- Live app served the new bundle hash.
- Live browser smoke passed across mobile and desktop routes with zero ignored console errors.
- Production canary passed `16/16`.

## Bad News / Limits

- GitHub Pages promotion failed twice before the Cloudflare fallback was used.
- The fallback changes the public serving layer from GitHub Pages behind
  Cloudflare to Cloudflare Workers static assets.
- Existing gateway Worker `gateway.activemirror.ai` was not changed.
- This receipt does not claim every repository or legacy surface is clean.

## Remaining Follow-Up

- Decide whether Cloudflare Workers static assets should remain the primary
  public serving layer.
- If yes, update deploy docs to mark GitHub Pages as fallback/history.
- If no, investigate GitHub Pages promotion failures before routing back.
- Keep public copy guards strict so proof-room and architecture language stays
  out of the first-use experience.

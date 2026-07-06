# Active Mirror Post-Deploy Receipt - Metadata Routes

Date: 2026-07-06

## Scope

Added real public metadata files so `/manifest.json`, `/robots.txt`, and `/sitemap.xml` no longer fall through to the root HTML app redirect.

## Files Changed

- `public/manifest.json`
- `public/robots.txt`
- `public/sitemap.xml`
- `public/app/index.html`
- `public/app/404.html`
- `scripts/production-canary.mjs`

Source-side companion changes were made in `/Users/mirror-pro/repos/activemirror-journey`:

- `index.html`
- `scripts/smoke_prod.sh`

## Route Contract

- `/manifest.json` serves JSON with `start_url` and `scope` set to `/app/`.
- `/robots.txt` serves plain text and points to `https://activemirror.ai/sitemap.xml`.
- `/sitemap.xml` serves XML and lists the current public app routes.
- `/app/` advertises `<link rel="manifest" href="/manifest.json" />`.

## Verification

- `/manifest.json` returned `200 application/json`.
- `/robots.txt` returned `200 text/plain`.
- `/sitemap.xml` returned `200 application/xml`.
- `npm run build:deploy` passed in `activemirror-journey`.
- `npm run app:package` passed in `active-mirror-site`.
- `npm run copy:audit` passed.
- `npm run guard:canonical` passed.
- `npm run build` passed.
- `npm run site:worker:dry` passed.
- `npm run site:worker:deploy` passed.
- Cloudflare deploy version: `d78fbe53-f328-4399-88d7-023f0ee38374`.
- `npm run canary:prod` passed `20/20`.
- `ACTIVE_MIRROR_BASE_URL=https://activemirror.ai/app npm run smoke:browser` passed mobile and desktop routes.
- `/Users/mirror-pro/repos/activemirror-journey` `npm run smoke:prod` passed.

## Bad News / Remaining Risk

- Browserslist data in `activemirror-journey` is stale by the build warning. This did not block the deploy, but should be handled as a maintenance slice.
- The unrelated local dirty file `docs/POST_DEPLOY_RECEIPT_2026-07-01_COUNCIL_CONTROL_PLANE.md` was left untouched.
- The unrelated untracked file `/Users/mirror-pro/repos/activemirror-journey/docs/ACTIVE_MIRROR_HARDENING_RESOLUTION_CONTRACTS.md` was left untouched.

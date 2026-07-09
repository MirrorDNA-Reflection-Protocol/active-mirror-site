# Active Mirror Edge Indexing Deploy Receipt - 2026-07-09

Status: `PARTIAL`.

Commit:

- `2bf7a7a Fix public edge indexing contract`

Deploy:

- Command: `npm run site:worker:deploy`
- Worker: `active-mirror-static-site`
- Version ID: `c4c72c6a-b159-44a7-8a3e-a1cf09f49add`
- Routes:
  - `activemirror.ai/*`
  - `www.activemirror.ai/*`

Changed scope:

- Added `/mirrorprod-india/` to `public/sitemap.xml`.
- Added `site-worker/index.js` to redirect `www.activemirror.ai` to apex with `308`.
- Updated `wrangler.site.jsonc` to bind static assets as `ASSETS` and run the site Worker first.
- Updated `scripts/production-canary.mjs` to check the `www` canonical redirect and MirrorProd sitemap entry.

Checked scope:

- `npm run deploy:preflight`: pass.
- `npm run site:worker:deploy`: pass.
- `npm run canary:prod`: `FAIL`, but edge/indexing checks passed.
- `python3 scripts/active_mirror_public_canary.py --skip-browser --json`: `FAIL`, but current public contract passed `19/19`.

Live proof:

- `www redirects to apex`: pass.
- `public metadata routes are real assets`: pass.
- Control-plane `current_contract`: `19` pass, `0` fail, `0` partial.
- Control-plane receipt: `/Users/mirror-pro/Documents/Active Mirror/runs/active-mirror-public-canary/20260709T110605Z/receipt.json`
- Control-plane receipt ID: `am_public_canary_20260709T110637Z_66793b2e`
- Control-plane receipt hash: `493a4fa5e99c4e5b5e3e1111ce9ce4933eb92a74d53ddde4af021f74be9d5e57`

Bad news:

- Production canary still fails on `mirror route returns a governed turn` because the live mirror route used fallback: `the live answer is unavailable right now`.
- Control-plane public canary still fails on `gateway_create` because `POST /v1/mirror/create` used fallback.
- Browser proof was skipped in the control-plane canary because the run used `--skip-browser`.
- This deploy does not prove provider/bridge health.

Remaining risk:

- The next repair is the gateway create/provider/bridge fallback state, not the static edge/indexing layer.

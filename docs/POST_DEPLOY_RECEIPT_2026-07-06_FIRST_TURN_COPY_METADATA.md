# Active Mirror Post-Deploy Receipt: First-Turn Copy And Metadata

Date: 2026-07-06

## Scope

- Consumer front door copy polish.
- Browser and Worker privacy fallback alignment.
- App install and link-preview metadata.
- Deploy smoke and red-team verification.

## Changed

- Packaged a fresh `/app/` bundle from `/Users/mirror-pro/repos/activemirror-journey`.
- Added clearer OG/Twitter metadata to the app HTML.
- Updated `public/manifest.json` with the product-facing description and PNG icon.
- Aligned Worker deterministic privacy fallback with the browser fallback.
- Updated browser smoke to expect `active-mirror-settings.json` instead of the old internal ID filename.

## Deploy

- Gateway Worker: `active-mirror-site-gateway`
- Gateway version: `caa3238e-7bf5-4b37-9ad0-aba66223aa3f`
- Static site Worker: `active-mirror-static-site`
- Static site version: `ef6ced5a-eebf-44dd-b72c-c817ee41450a`

## Verification

- Source build: `npm run build:deploy` in `/Users/mirror-pro/repos/activemirror-journey`
- Worker tests: `npm run worker:test`
- Local red team: `npm run redteam:local` (`100/100`, failed `0`, fallback `0`)
- Deploy gates:
  - `npm run copy:audit`
  - `npm run guard:canonical`
  - `npm run build`
  - `npm run site:worker:dry`
- Live checks:
  - `npm run canary:prod` (`20/20`)
  - `npm run redteam:prod-smoke` (`20/20`, failed `0`, fallback `0`)
  - `npm run smoke:prod`
  - `ACTIVE_MIRROR_BASE_URL=https://activemirror.ai/app npm run smoke:browser`
  - `SMOKE_SCREENSHOT_DIR=/tmp/active-mirror-smoke-20260706 ACTIVE_MIRROR_BASE_URL=https://activemirror.ai/app npm run smoke:browser`

## Checked Routes

- `https://activemirror.ai/`
- `https://activemirror.ai/app/`
- `https://activemirror.ai/app/id/`
- `https://activemirror.ai/app/device/`
- `https://activemirror.ai/app/enterprise/`
- `https://activemirror.ai/app/about/`
- `https://activemirror.ai/app/research/`
- `https://activemirror.ai/app/privacy/`
- `https://activemirror.ai/app/terms/`
- root aliases and metadata routes: `/manifest.json`, `/robots.txt`, `/sitemap.xml`

## Bad News / Limits

- The share image is the existing brand poster asset, not a new product-scene social card.
- Saved context remains browser-local and user-controlled; this deploy does not add cross-device sync.
- Unrelated dirty file preserved: `docs/POST_DEPLOY_RECEIPT_2026-07-01_COUNCIL_CONTROL_PLANE.md`.


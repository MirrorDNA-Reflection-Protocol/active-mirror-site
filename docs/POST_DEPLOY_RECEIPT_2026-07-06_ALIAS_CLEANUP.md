# Active Mirror Post-Deploy Receipt - Alias Cleanup

Date: 2026-07-06

## Scope

Removed stale standalone public pages from the legacy root aliases:

- `/product/`
- `/pricing/`
- `/trust/`
- `/mirror/`

These routes now redirect into the current app surface instead of exposing the older workspace/product/pricing/trust copy.

## Route Contract

- `/product/` -> `/app/`
- `/mirror/` -> `/app/`
- `/pricing/` -> `/app/enterprise/`
- `/trust/` -> `/app/privacy/`

## Files Changed

- `product/index.html`
- `mirror/index.html`
- `pricing/index.html`
- `trust/index.html`

## Verification

- `npm run copy:audit` passed.
- `npm run guard:canonical` passed.
- `npm run build` passed.
- `npm run site:worker:dry` passed.
- `npm run site:worker:deploy` passed.
- Cloudflare deploy version: `718ab7d2-630f-4188-b099-72fa01eda438`.
- Live raw alias audit found no old page copy in `/product/`, `/pricing/`, `/trust/`, or `/mirror/`.
- Live browser redirect check confirmed:
  - `/product/` landed on `https://activemirror.ai/app/`
  - `/pricing/` landed on `https://activemirror.ai/app/enterprise/`
  - `/trust/` landed on `https://activemirror.ai/app/privacy/`
  - `/mirror/` landed on `https://activemirror.ai/app/`
- `npm run canary:prod` passed `18/18`.
- `ACTIVE_MIRROR_BASE_URL=https://activemirror.ai/app npm run smoke:browser` passed mobile and desktop routes.
- `/Users/mirror-pro/repos/activemirror-journey` `npm run smoke:prod` was updated to the current public route contract and passed.

## Bad News / Remaining Risk

- `/manifest.json` currently resolves as a 200 fallback page rather than a JSON manifest. It is not part of the current app route contract, but it should be added or explicitly removed from future PWA expectations.
- The unrelated local dirty file `docs/POST_DEPLOY_RECEIPT_2026-07-01_COUNCIL_CONTROL_PLANE.md` was left untouched.
- The unrelated untracked file `/Users/mirror-pro/repos/activemirror-journey/docs/ACTIVE_MIRROR_HARDENING_RESOLUTION_CONTRACTS.md` was left untouched.

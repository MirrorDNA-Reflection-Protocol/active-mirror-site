# Post-Deploy Receipt: Offline Useful Fallbacks

## Target

- Surface: `https://activemirror.ai/app/`
- Service: `active-mirror-static-site`
- Deploy source worktree: `/Users/mirror-pro/repos/active-mirror-site-clean-deploy`
- Product source commit: `activemirror-journey@c61a07b`
- Static deploy commit: `active-mirror-site@8d2adff`
- MirrorProd cleanup commit: `active-mirror-site@cde37d5`
- Deployed Worker version id: `051a6ebf-81a2-40ec-a0a3-da7ad3939bcc`
- Verified at: `2026-07-09T10:43:07Z`

## Promoted Behavior

- Bare artifact asks such as `poster` open a local-first draft surface instead
  of waiting for a remote media/model route.
- Source-seeking asks now return a useful search/compare plan when the page
  cannot reach the web route.
- Browser saved-chat continuity remains available for short interruptions.

## Pre-Deploy Checks

- `npm run deploy:preflight`: pass
  - canonical deploy guard: pass
  - public deploy boundary guard: pass
  - public copy audit: pass
  - build: pass
  - Cloudflare static Worker dry-run: pass

## Deploy

- `npm run site:worker:deploy`: pass
- Cloudflare triggers:
  - `activemirror.ai/*`
  - `www.activemirror.ai/*`

## Post-Deploy Checks

- `node scripts/browser-smoke.mjs`: pass across mobile and desktop app routes.
- `npm run smoke:interaction`: pass.
- `https://activemirror.ai/app/`: pass, serves current app asset
  `index-DINNgUE0.js`.
- `https://activemirror.ai/sitemap.xml`: pass, no `mirrorprod` entry.
- `https://activemirror.ai/assets/og-mirrorprod.png`: returns HTML, not media.
- `https://activemirror.ai/videos/mprod-testimonial.mp4`: returns HTML, not
  media.

## Bad News And Resolution

- A parallel thread pushed `6ad16b6 Restore MirrorProd public route` to
  `origin/main` after the clean app deploy.
- That commit was preserved at
  `origin/mirrorprod/archive-active-site-restore-20260709`.
- It was then reverted from Active Mirror `main` by `cde37d5` so the public
  repo source and static Worker stay Active Mirror canonical.

## Remaining Risk

- This receipt proves the public static app route and browser smoke checks.
- It does not prove the Mini-hosted model route, because the Mini/home network
  was unavailable during this deploy.
- The original local worktree `/Users/mirror-pro/repos/active-mirror-site` is
  behind `origin/main` and contains an unrelated modified receipt doc. It was
  intentionally not touched.

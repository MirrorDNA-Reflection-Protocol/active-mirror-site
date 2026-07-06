# Active Mirror Post-Deploy Receipt: About Page

Date: 2026-07-06

## Scope

Added a small `/app/about/` page to the canonical Active Mirror app source and deployed the packaged app through the Cloudflare static Worker.

## Changed

- Source route added in `/Users/mirror-pro/repos/activemirror-journey/src/App.jsx`.
- New page added in `/Users/mirror-pro/repos/activemirror-journey/src/pages/About.jsx`.
- Footer utility link added in `/Users/mirror-pro/repos/activemirror-journey/src/pages/HomePage.jsx`.
- Public language guard now scans About.
- Truth manifest now includes About.
- Browser smoke now checks `/app/about/`.
- Root `/about/` now redirects to `/app/about/`.
- Deploy repo packaged the new `/public/app` bundle.

## Verification

- Source build: `npm run build:deploy` passed.
- Source guards: canonical, mirror, continuity, front-door, public language, multilingual, friction, challenge, redaction, and truth passed.
- Deploy gates: `npm run copy:audit`, `npm run guard:canonical`, and `npm run build` passed.
- Local browser smoke against `http://127.0.0.1:4194/app` passed for mobile and desktop, including About.
- Visual screenshots reviewed:
  - `/tmp/active-mirror-about-mobile.png`
  - `/tmp/active-mirror-about-desktop.png`
- Cloudflare static Worker deploy succeeded.
- Worker version for About route: `2cb6b5e4-da17-44a4-bc41-1a81bfb27fbb`.
- Worker version for root About alias: `fee7b78e-724b-4f82-a429-9c39fa4c83c7`.
- Production browser smoke against `https://activemirror.ai/app` passed for mobile and desktop, including About.
- Production browser check confirmed `https://activemirror.ai/about/` resolves to `https://activemirror.ai/app/about/`.
- Production canary passed `18/18` after route-alias coverage was expanded for About, Privacy, Terms, Enterprise, Consulting, and Research.

## Bad News / Limits

- The truth gate is scoped verification. It does not prove whole-repo, whole-computer, or external certification truth.
- Direct HTML curl for `/app/about/` only proves the React shell and asset hashes because About text is lazy-loaded client-side.
- The internal enterprise endpoint path still contains `proof-sprint` for compatibility. Public visible copy now uses workflow language.

## Remaining Risk

- Old root-page runtime files still exist in the deploy repo and should continue to be treated as legacy public-shell debt unless the root site is intentionally refreshed.
- GitHub Pages may still deploy after push, but the active live route is currently served by the Cloudflare static Worker.

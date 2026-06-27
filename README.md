# Active Mirror Site

Deploy and gateway repo for the Active Mirror public surface.

## Canonicalization Notice

New Active Mirror product/front-door source work starts in:

```text
/Users/mirror-pro/repos/activemirror-journey
```

This repo remains useful for:

- the GitHub Pages deployment bundle for `activemirror.ai`;
- the Cloudflare Worker gateway for `gateway.activemirror.ai`;
- Vite public-site history and migration references;
- copy audit scripts and public-copy precedent;
- migration of specific homepage/trust/docs work into the canonical product repo.

Do not hand-edit `public/app/assets/*.js`. Build the product app in
`/Users/mirror-pro/repos/activemirror-journey`, then package it here with
`npm run app:package`.

## Status

- Treat this repo as the deploy/gateway surface, not the source UI surface.
- Port useful product changes into `/Users/mirror-pro/repos/activemirror-journey`.
- `id.activemirror.ai` is a compatibility domain; the live MirrorSeed product route is `/app/id/`.
- Do not use `/Users/mirror-pro/Documents/Active Mirror/commercial-site` as the source of truth going forward.
- Do not edit `MirrorDNA-Reflection-Protocol/activemirror-pages` as source after cutover; treat it as legacy deployment history.

## Local Commands

```sh
npm install
npm run dev
npm run guard:canonical
npm run audit:repos
npm run build
npm run app:package
npm run worker:dev
npm run worker:deploy
```

## Runtime Routing Policy

Active Mirror should expose product capabilities, not raw provider choices.

- Decision reasoning: reflection route.
- Chat polish, critique, and receipt review: critique route.
- Images, video, and multimodal media work: media route.
- Browser frontend: no provider secrets.
- Cloud routes: server-side gateway only, with explicit boundary and receipt output.
- Provider failures fail soft: the gateway falls back to the next available safe route or deterministic local structure and records the fallback in the receipt.
- The `/mirror/` workspace calls `https://gateway.activemirror.ai/v1/mirror/create` and keeps a browser-local fallback if the gateway is unavailable.

Current Worker capabilities:

- Reflection help
- Critique and rewrite help
- Media and visual help

The static site runs as a local browser demo until the Worker is deployed with provider secrets. Provider keys must be configured as Worker secrets, never committed or exposed in browser JavaScript.

Live gateway: `https://gateway.activemirror.ai/health`

## UX Stress Kit

The reusable release gate lives in `active-mirror-ux-stress-kit/`.
It defines the doctrine, component contracts, JSON Schemas, QA prompts, stress-test matrix, and release-readiness template for inspectable, interruptible, reversible, consent-aware Active Mirror UX.

## Product Lock

The v0.1 product lock lives in `docs/ACTIVE_MIRROR_V0_1_LOCK.md`.
Use it before changing the public product story or browser workspace loop.

## Deployment

The GitHub Actions workflow builds the Vite site and publishes `dist` to `gh-pages`.
`public/CNAME` and the deploy workflow `cname` setting pin the intended
production domain. This is the only Active Mirror repo that should claim
`activemirror.ai`.

# Active Mirror Site

Legacy/migration source for the Active Mirror public and commercial web surface.

## Canonicalization Notice

New Active Mirror product/front-door work now starts in:

```text
/Users/mirror-pro/repos/activemirror-journey
```

This repo remains useful for:

- Vite public-site history;
- Worker gateway deployment notes and live deployment bridge;
- copy audit scripts and public-copy precedent;
- migration of specific homepage/trust/docs work into the canonical repo.

Do not start new homepage, BrainScan, Mirror Seed, or consumer chat work here unless Paul explicitly reopens this lane.

## Status

- Treat this repo as a migration source unless explicitly instructed otherwise.
- Port useful product changes into `/Users/mirror-pro/repos/activemirror-journey`.
- Do not use `/Users/mirror-pro/Documents/Active Mirror/commercial-site` as the source of truth going forward.
- Do not edit `MirrorDNA-Reflection-Protocol/activemirror-pages` as source after cutover; treat it as legacy deployment history.

## Local Commands

```sh
npm install
npm run dev
npm run build
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
`public/CNAME` pins the intended production domain.

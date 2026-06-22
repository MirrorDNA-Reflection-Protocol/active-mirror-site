# Active Mirror Site

Canonical source repo for the Active Mirror public and commercial web surface.

## Status

- Edit this repo for the public site.
- Build artifacts are generated from this repo.
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

- Reflective reasoning: GPT-first.
- Chat polish, critique, and receipt review: Claude.
- Images, video, and multimodal media work: Gemini.
- Browser frontend: no provider secrets.
- Cloud routes: server-side gateway only, with explicit boundary and receipt output.
- Provider failures fail soft: the gateway falls back to the next available safe route or deterministic local structure and records the fallback in the receipt.
- The `/mirror/` workspace calls `https://gateway.activemirror.ai/v1/mirror/create` and keeps a browser-local fallback if the gateway is unavailable.

Current Worker defaults:

- Reflection: `gpt-5.5`
- Chat critique: `claude-sonnet-4-6`
- Media text/planning: `gemini-3.5-flash`
- Image generation: `gemini-3.1-flash-image`
- Video generation: `veo-3.1-fast-generate-preview`

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

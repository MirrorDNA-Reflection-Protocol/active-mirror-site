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

Current Worker defaults:

- Reflection: `gpt-5.5`
- Chat critique: `claude-sonnet-4-6`
- Media text/planning: `gemini-3.5-flash`
- Image generation: `gemini-3.1-flash-image`
- Video generation: `veo-3.1-fast-generate-preview`

The static site runs as a local browser demo until the Worker is deployed with provider secrets. Provider keys must be configured as Worker secrets, never committed or exposed in browser JavaScript.

## Deployment

The GitHub Actions workflow builds the Vite site and publishes `dist` to `gh-pages`.
`public/CNAME` pins the intended production domain.

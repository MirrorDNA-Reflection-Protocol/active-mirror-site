# Canonical Site Repo

Date: 2026-06-21
Updated: 2026-06-25
Updated: 2026-06-27

`MirrorDNA-Reflection-Protocol/active-mirror-site` was the canonical Active Mirror public-site repository during the Vite/GitHub Pages cutover.

As of the 2026-06-25 March-gold restore, new Active Mirror product/front-door work should start in:

```text
/Users/mirror-pro/repos/activemirror-journey
```

`MirrorDNA-Reflection-Protocol/activemirror-genui` is now a reference/prototype repo for Next.js GenUI and runtime experiments, not the default place to rebuild the public front door.

## Why

The site had drifted across:

- `/Users/mirror-pro/Documents/Active Mirror/commercial-site`
- temporary clones of `MirrorDNA-Reflection-Protocol/activemirror-pages`
- the Active Mirror control-plane repository
- generated deploy artifacts on the `gh-pages` branch

That made it too easy to patch the wrong surface.

## Rule

New source changes for the public front door, setup, and consumer reflection chat start in `/Users/mirror-pro/repos/activemirror-journey`.

Use `/Users/mirror-pro/repos/activemirror-genui` only when deliberately migrating a specific GenUI/runtime experiment.

This repo is the deploy/gateway surface for `activemirror.ai` and
`gateway.activemirror.ai`. It is also a migration source for prior Vite
public-site work, Worker gateway notes, and copy-audit precedent.
The deploy branch owns generated static output only. When packaging the current
product app into `/Users/mirror-pro/repos/active-mirror-site/public/app`, copy
only the Vite app shell and assets (`index.html`, `404.html`, `assets/`). Do not
copy stale top-level static pages from the product repo's `public/` directory
into `/app`; those pages can override the React routes.

`id.activemirror.ai` is not a separate product surface now. It is a compatibility
domain maintained by `/Users/mirror-pro/repos/active-mirror-identity`, and it
should redirect into the canonical setup route:

```text
https://activemirror.ai/app/start/
```

## Cutover Checklist

- Build locally with `npm run build`.
- Confirm which repo owns the next deploy before publishing.
- If deploying from this repo, push `main` and confirm GitHub Actions publishes `dist` to `gh-pages`.
- Move the production custom domain only after the new Pages deployment is healthy.
- Keep the old `activemirror-pages` repo as rollback history until the new repo has proven stable.

For the current repo map and local CNAME audit, see:

```text
docs/ACTIVE_MIRROR_REPO_MAP.md
npm run audit:repos
```

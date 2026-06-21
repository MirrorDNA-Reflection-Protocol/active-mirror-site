# Canonical Site Repo

Date: 2026-06-21

`MirrorDNA-Reflection-Protocol/active-mirror-site` is the canonical Active Mirror public-site repository moving forward.

## Why

The site had drifted across:

- `/Users/mirror-pro/Documents/Active Mirror/commercial-site`
- temporary clones of `MirrorDNA-Reflection-Protocol/activemirror-pages`
- the Active Mirror control-plane repository
- generated deploy artifacts on the `gh-pages` branch

That made it too easy to patch the wrong surface.

## Rule

Source changes for the public site start here.
The control-plane repo owns runtime/kernel work.
The deploy branch owns generated static output only.

## Cutover Checklist

- Build locally with `npm run build`.
- Push `main`.
- Confirm GitHub Actions publishes `dist` to `gh-pages`.
- Move the production custom domain only after the new Pages deployment is healthy.
- Keep the old `activemirror-pages` repo as rollback history until the new repo has proven stable.


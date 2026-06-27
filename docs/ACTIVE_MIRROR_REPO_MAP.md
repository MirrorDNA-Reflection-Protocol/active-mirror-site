# Active Mirror Repo Map

Date: 2026-06-27

This is the canonical map for public Active Mirror web work.

## Canonical Public Path

```text
/Users/mirror-pro/repos/activemirror-journey
  -> product source app
  -> npm run build:deploy
  -> /Users/mirror-pro/repos/active-mirror-site/public/app
  -> active-mirror-site GitHub Pages
  -> https://activemirror.ai/app/
```

## Repo Roles

| Repo | Role | Public domain claim |
| --- | --- | --- |
| `/Users/mirror-pro/repos/activemirror-journey` | Product source for homepage, reflection chat, BrainScan, MirrorSeed, device, privacy, terms, enterprise UI | None. Must not contain `CNAME`. |
| `/Users/mirror-pro/repos/active-mirror-site` | Deploy and gateway repo. Packages `activemirror-journey/dist` into `public/app`, publishes Pages, owns Worker gateway. | `activemirror.ai` via `public/CNAME` and workflow `cname`. |
| `/Users/mirror-pro/repos/active-mirror-identity` | MirrorSeed archive and compatibility surface. | `id.activemirror.ai`, redirects to `https://activemirror.ai/app/id/`. |
| `/Users/mirror-pro/repos/activemirror-genui` | Prototype/reference repo for GenUI and runtime experiments. | None for the public front door. |
| `/Users/mirror-pro/repos/activemirror-pages` | Legacy deploy/history repo. | Should not be edited as source. Any old `activemirror.ai` claim is stale. |
| `/Users/mirror-pro/repos/activemirror-site` | Legacy gh-pages/history checkout. | Should not be edited as source. Dirty local state may exist. |
| `/Users/mirror-pro/repos/activemirror-site-corrupted` | Corrupted legacy/reference checkout. | Should not be edited as source. Any old `activemirror.ai` claim is stale. |

## Rules

- New consumer/product changes start in `activemirror-journey`.
- Live deploy and gateway changes start in `active-mirror-site`.
- `id.activemirror.ai` is not a separate product. It is a redirect/archive.
- Do not patch generated bundles by hand.
- Do not revive old `activemirror.ai` CNAME claims from legacy repos.
- If a legacy repo has useful design material, port the idea into the canonical source repo, then package through the deploy repo.

## Checks

```bash
cd /Users/mirror-pro/repos/activemirror-journey
npm run guard:canonical
npm run build:deploy

cd /Users/mirror-pro/repos/active-mirror-site
npm run app:package
npm run guard:canonical
npm run audit:repos
npm run build
npm run copy:audit
```

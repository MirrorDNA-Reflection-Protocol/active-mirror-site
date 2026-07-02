# Public Copy Friction Sweep

This is the first non-demo local MirrorSkill.

It checks actual Active Mirror public-site source for hard copy-audit failures and user-facing friction markers. It only writes a local review packet. It cannot edit copy, deploy, send messages, call connectors, or promote memory.

## Run

```bash
npm run amos:copy-sweep
```

Run through the queue:

```bash
npm run amos:queue -- --queue docs/design-thinking-system/fixtures/public-copy-friction-task-queue.json
```

Validate the skill contract:

```bash
npm run amos:skill -- --skill docs/design-thinking-system/mirrorskills/public-copy-friction-sweep
```

## Default Output

```text
/tmp/active-mirror-site/amos-public-copy-friction/public-copy-friction-report.json
/tmp/active-mirror-site/amos-public-copy-friction/public-copy-friction-report.md
```

## Scope

Reads:

- `index.html`
- `mirror/index.html`
- `product/index.html`
- `trust/index.html`
- `pricing/index.html`
- `privacy/index.html`
- `terms/index.html`
- `src/main.js`

Does not:

- edit source;
- deploy;
- send messages;
- call external connectors;
- promote memory.

## Promotion Rule

This stays a candidate skill until it succeeds on three local copy reviews and has one documented blocked finding.

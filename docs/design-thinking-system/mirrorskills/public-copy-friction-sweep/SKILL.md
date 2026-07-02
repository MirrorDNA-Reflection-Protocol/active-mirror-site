# Public Copy Friction Sweep MirrorSkill

## Purpose

Review actual public-site copy for confusing internal language, client-boundary leaks, and hard-audit failures without changing the site.

## Inputs

- Public copy audit script.
- Public copy friction sweep script.
- Public site source.
- Task queue.

## Outputs

- Public copy friction report.
- Local Markdown review packet.
- Queue run receipt.
- Task event log.

## Permissions

Allowed:

- Read public-site source.
- Run copy audit.
- Write local review packet.

Denied:

- Edit public copy.
- Deploy site.
- Send messages.
- Publish content.
- Call external connectors.
- Promote memory.

## Failure Modes

- Public copy audit fails.
- Client-boundary marker appears.
- Internal language is detected and needs review.

## Commands

```bash
npm run amos:copy-sweep
npm run amos:queue -- --queue docs/design-thinking-system/fixtures/public-copy-friction-task-queue.json
npm run amos:skill -- --skill docs/design-thinking-system/mirrorskills/public-copy-friction-sweep
```

## Receipt Fields

- `queue_run_id`
- `workflow_id`
- `tasks`
- `external_actions_executed`
- `risks_remaining`

## Promotion

This remains a candidate skill until it succeeds on three local copy reviews and has one documented blocked finding.

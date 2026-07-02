# Campaign Approval Demo MirrorSkill

## Purpose

Create a reviewable launch note from demo-approved context, hold outbound action for approval, and prove the path through queue and execution gates.

## Inputs

- Approved demo brief.
- ToolGraph record.
- Task queue.

## Outputs

- Approval packet.
- Local approval console.
- Decision receipt.
- Execution-gate receipt.
- Queue run receipt.
- Task event log.

## Permissions

Allowed:

- Read demo fixture.
- Write local artifacts.
- Record local decision.
- Run execution gate.

Denied:

- Send messages.
- Publish content.
- Call external connectors.
- Promote memory.

## Failure Modes

- Client-boundary marker appears.
- Tool is not registered.
- Queue dependency is unmet.
- Decision receipt is tampered.
- Approval is present but workflow scope forbids external action.

## Commands

```bash
npm run amos:skill
npm run amos:queue
npm run amos:guard
```

## Receipt Fields

- `queue_run_id`
- `workflow_id`
- `tasks`
- `external_actions_executed`
- `risks_remaining`

## Promotion

This remains a candidate skill until it succeeds on three real non-demo workflows and has one documented failure mode.

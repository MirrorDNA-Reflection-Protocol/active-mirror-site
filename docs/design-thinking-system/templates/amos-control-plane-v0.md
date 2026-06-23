# AMOS Control Plane v0

Use this to specify the first local AMOS runtime.

## Purpose

Coordinate model routing, allowed tools, vault access, task queue, receipts, and approvals from a local runtime.

## First Runtime Assumption

| Layer | v0 choice |
| --- | --- |
| Primary runtime | Local Mac Mini |
| Primary UI | Browser workspace |
| Capture limb | OnePlus |
| Sensitive approval limb | Pixel |
| Vault | Local first |
| External models/tools | Purpose-limited, approved, receipted |

## Core Services

| Service | Job | Required receipt |
| --- | --- | --- |
| Router | Select local/browser/hosted/tool route | Route and reason |
| ToolGraph | Check tool permission and fallback | Tool record ID |
| Vault access | Read/write approved memory and artifacts | Scope and memory decision |
| Task queue | Stage and run work | Task ID and status |
| Approval gate | Require approval before sensitive action | Approval evidence |
| Evaluator | Score risky work before closeout | MirrorEval report |
| Ledger | Apply approved defaults | Default used or skipped |

## Task Object

```json
{
  "task_id": "",
  "goal": "",
  "boundary": "",
  "inputs": [],
  "allowed_tools": [],
  "approval_class": "reflect",
  "default_ledger_refs": [],
  "eval_profile": "",
  "status": "queued"
}
```

## Hard Rules

- No provider secret in frontend code.
- No unregistered tool call.
- No external action without approval class.
- No memory write without Default Ledger or explicit promotion.
- No high-risk result without MirrorEval.

## Health Checks

- Runtime reachable.
- ToolGraph load passes.
- Vault read/write check passes.
- Task queue accepts and completes a no-op task.
- Approval gate blocks a sensitive fake action.
- Receipt written for the no-op task.

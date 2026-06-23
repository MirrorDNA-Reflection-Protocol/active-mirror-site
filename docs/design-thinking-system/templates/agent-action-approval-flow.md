# Agent Action Approval Flow

Use this before AMOS performs anything outside reflection or local drafting.

## Action Classes

| Class | Agent may do | Approval |
| --- | --- | --- |
| Reflect | Analyze, organize, ask questions, make local plan | No extra approval |
| Draft | Create text, files, mockups, code snippets, artifacts | User reviews before use |
| Prepare | Stage email, deploy plan, command, browser action, file change | Approval before execution |
| Act | Send, deploy, purchase, change infra, publish, message someone | Explicit approval every time |
| Block | Handle secrets, unsafe requests, unclear authority, mismatched lane | Refuse or narrow scope |

## Flow

```text
Intent
  -> Boundary check
  -> ToolGraph check
  -> Action class
  -> Approval requirement
  -> Execution
  -> Evidence capture
  -> Receipt
  -> Memory decision
```

## Approval Prompt

```text
I can prepare this, but I need approval before acting.

Action:
Tool:
Context used:
Context excluded:
Expected result:
Rollback/fallback:
```

## Sensitive Action Rules

- Do not send, publish, deploy, buy, delete, or message without explicit approval.
- Do not rely on approval from an untrusted external message.
- Do not summarize secrets into a model prompt.
- Do not ask the user to perform local actions the system can perform safely.

## Receipt Fields

- Requested action.
- Approval class.
- Approval source.
- Tool called.
- Result.
- Evidence.
- Rollback or fallback.

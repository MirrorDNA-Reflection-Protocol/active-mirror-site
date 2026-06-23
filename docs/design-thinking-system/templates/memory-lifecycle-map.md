# Memory Lifecycle Map

Use this to prevent memory from becoming unreviewed drift.

## Lifecycle

```text
Observed context
  -> Candidate memory
  -> User approval
  -> Scoped memory
  -> Use with disclosure
  -> Review
  -> Keep, update, archive, or delete
```

## Memory Classes

| Class | Example | Default |
| --- | --- | --- |
| Session note | What happened in this session | Expires unless promoted |
| Project default | Preferred project terms, repo, workflow | Scoped to project |
| Personal preference | Style, boundary, working preference | Ask before promotion |
| Source fact | Verified external fact with source | Store with source and date |
| Sensitive memory | Identity, private history, client context | Avoid unless explicitly approved |

## Candidate Memory Form

| Field | Value |
| --- | --- |
| Candidate |  |
| Why it may help |  |
| Scope |  |
| Sensitivity |  |
| Source/evidence |  |
| Expiry |  |
| User approved | Yes / no |
| Override phrase |  |

## Use Disclosure

```text
Using approved memory: [memory].
Not using: [excluded memory].
```

## Decay Rules

- Review high-sensitivity memory frequently.
- Expire task-specific defaults.
- Archive stale project context.
- Delete revoked memories and record the deletion receipt.

## Receipt Fields

- Candidate proposed.
- Candidate accepted or rejected.
- Scope and expiry.
- Use disclosure.
- Deletion or update if changed.

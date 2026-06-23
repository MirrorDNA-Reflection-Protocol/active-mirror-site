# Role Critique Panel

Use this before shipping a design, workflow, tool route, memory default, or public claim.

## Panel Setup

| Field | Value |
| --- | --- |
| Artifact under review |  |
| User goal |  |
| Intended audience |  |
| Risk level |  |
| Evidence available |  |
| Decision needed | Ship / revise / block |

## Role Cards

### UX Reviewer

- Can the user understand what happened?
- Can the user undo, edit, or recover?
- Does the surface explain itself through interaction instead of instruction text?

### PM Reviewer

- Does this solve the user's real job?
- Is the scope narrow enough to ship?
- Does it avoid confusing internal language?

### Engineer Reviewer

- Can this be implemented without brittle assumptions?
- Is the responsive behavior testable?
- Is there a rollback or fallback path?

### Privacy Reviewer

- Was context minimized?
- Was consent explicit?
- Are memory and external routes receipted?

### QA Reviewer

- What breaks on mobile, slow network, empty state, long text, or failed tool calls?
- What would a user misunderstand?
- What needs a regression check?

## Finding Format

```text
Role:
Severity:
Finding:
Evidence:
Repair:
Ship decision:
```

## Exit Criteria

- No high-severity finding is unresolved.
- Medium findings have owner and follow-up.
- Public claims have source or are removed.
- Production code has a QA route.

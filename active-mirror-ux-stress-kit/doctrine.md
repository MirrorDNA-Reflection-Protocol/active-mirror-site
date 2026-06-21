# UX Doctrine

## Positioning Rule

Active Mirror is not primarily a workspace. The workspace and console are interfaces. The product is the user-owned identity, memory, consent, context, and continuity layer for AI.

Public product language should stay concrete:

> Work with AI without losing the thread.

Company thesis language can be sharper:

> Active Mirror is building a user-side control layer for AI agency.

## Seven Screen Questions

Every meaningful screen should answer:

1. What does the mirror know?
2. Where did that knowledge come from?
3. Is it verified, inferred, stale, sensitive, or conflicting?
4. What context is being used for this task?
5. What is the AI allowed to do?
6. What is the AI about to do?
7. Can the user stop, edit, revoke, undo, or roll back?

## Non-Negotiables

- Memory is not authority. Consent is authority.
- Tool access is not permission to act.
- Reading is not modifying.
- Drafting is not sending.
- Planning is not executing.
- Thinking is not retrieving.
- Local-first is a route state, not a slogan.
- If the system does not know, it must say `Unknown`.
- Client and personal contexts must never silently mix.
- Every irreversible action must show reversibility status before approval.

## Primary Surfaces

### Mirror Console Home

Purpose: one clear command surface for the user's AI identity state.

Must show:

- active context;
- project/client scope;
- active agents;
- active tools;
- recent memory changes;
- pending approvals;
- risk alerts;
- local/cloud status;
- last backup or export.

Acceptance: a new user can tell in under 10 seconds whether the system is observing, drafting, or acting.

### Memory Inspector

Purpose: inspect, edit, approve, delete, scope, and export memory.

Required memory labels:

- Known
- Inferred
- User-confirmed
- Unverified
- Stale
- Sensitive
- Client-only
- Local-only
- Conflict detected
- Needs review
- Never share
- Temporary
- Permanent

### Context Packet Preview

Purpose: show the exact context about to be sent to a model or agent.

Required actions:

- Approve once
- Approve for this project
- Remove memory item
- Add memory item
- Mark as sensitive
- Force local-only
- Cancel

### Consent Firewall

Purpose: every agentic action passes through explicit permission.

Action classes:

- Read
- Retrieve
- Summarize
- Draft
- Edit
- Export
- Send
- Delete
- Archive
- Publish
- Book
- Pay
- Forward
- Share
- Execute command
- Modify repo
- Modify calendar
- Access sensitive memory

Approval states:

- Allowed
- Blocked
- Needs approval
- Allowed only locally
- Allowed only for this project
- Allowed only once
- Allowed after redaction
- Requires stronger confirmation

### Agent Action Console

Purpose: make agent state legible.

State labels:

- Idle
- Listening
- Thinking
- Retrieving context
- Checking permissions
- Drafting
- Planning
- Waiting for approval
- Executing
- Verifying result
- Completed
- Failed
- Blocked
- Rolled back

### Memory Conflict Resolver

Purpose: resolve contradictions before they poison context.

Conflict types:

- new memory contradicts old memory;
- client scope conflict;
- personal/business boundary conflict;
- sensitive/non-sensitive conflict;
- fresh/stale conflict;
- user correction conflict;
- tool output contradicts memory;
- web source contradicts memory.

### Audit Trail

Purpose: every important memory, action, and context route is traceable.

After any important action, the user should be able to answer:

- What happened?
- Which model did it?
- Which memories were used?
- Which tools were used?
- Was approval granted?
- Can it be reversed?

### Local/Cloud Boundary

Purpose: make locality visible.

Trust modes:

- Local-only
- Local-first with approved frontier help
- Cloud-assisted
- Client-confidential
- Public-safe
- Emergency lockdown

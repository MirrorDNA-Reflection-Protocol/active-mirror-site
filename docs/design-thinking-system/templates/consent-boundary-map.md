# Consent Boundary Map

Use this before any memory, external model, tool, upload, message, deploy, or browser action.

## Purpose

Define what context may be used, what must stay local, and what requires explicit approval.

## Boundary Classes

| Class | Examples | Default |
| --- | --- | --- |
| Public | Public website copy, public docs, published links | Usable |
| Working | Drafts, notes, plans, screenshots, rough ideas | Local first |
| Personal | Identity, history, feelings, private life context | Ask before use |
| Client | Client names, files, messages, private strategy | Ask every time |
| Secret | API keys, passwords, tokens, credentials | Never share |
| Action | Emails, posts, deploys, purchases, infra changes | Approve before action |

## Consent Decision

| Field | Value |
| --- | --- |
| Task |  |
| Context requested |  |
| Context allowed |  |
| Context excluded |  |
| Tool/model route |  |
| Retention | Ephemeral / session / approved memory |
| Expiry |  |
| Revocation method |  |
| Approval evidence |  |

## Approval Modes

- Reflect: no external action.
- Draft: produces an editable artifact only.
- Prepare: stages an action but does not send or deploy.
- Act: performs an external action after approval.
- Block: refuses or asks for safer scope.

## Receipt Requirements

- What was used.
- What was excluded.
- Who approved.
- Where it went.
- Whether it was retained.
- How to revoke.

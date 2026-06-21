# Figma Structure

Recommended pages:

```text
00 Doctrine
01 Mirror Console Home
02 Memory Inspector
03 Context Packet Preview
04 Consent Firewall
05 Agent Action Console
06 Memory Conflict Resolver
07 Audit Trail
08 Local Cloud Boundary
09 Empty Error Recovery States
10 Mobile Edge Capture
11 Shield Trust Review
12 Component Library
13 UX Stress Test Matrix
```

## Page Acceptance Checks

### 00 Doctrine

- Shows the seven screen questions.
- Separates public product language from internal doctrine.
- Lists claims to avoid.

### 01 Mirror Console Home

- Shows current mode: observing, drafting, or acting.
- Shows active scope and local/cloud route state.
- Shows pending approvals and risk alerts.

### 02 Memory Inspector

- Every memory has provenance, scope, sensitivity, confidence, and consent rule.
- User can edit, delete, scope, export, or mark as local-only.

### 03 Context Packet Preview

- User can see included and excluded context before a model call.
- User can remove, redact, or force local-only.
- Risk and token estimate are visible.

### 04 Consent Firewall

- Irreversible actions require explicit approval.
- Approval prompt shows destination, data used, risk, and reversibility.

### 05 Agent Action Console

- Agent state is never blurred.
- Long tasks can be paused, inspected, canceled, or forced into safe mode.

### 06 Memory Conflict Resolver

- Conflict shows older and newer memory, source, date, and recommendation.
- User can keep both with scope, supersede, delete, verify, or require approval.

### 07 Audit Trail

- Events show actor, action type, model, tools, approval state, result, and rollback status.

### 08 Local Cloud Boundary

- Screen shows data staying local and data leaving device.
- Local-only mode blocks external model/tool calls.

### 09 Empty Error Recovery States

- Empty states tell the user what is missing and what action is safe.
- Error states expose route, failure, retry path, and whether anything was saved.

### 10 Mobile Edge Capture

- User can capture a thought in under 10 seconds.
- Capture can be marked temporary, private, client-specific, or deferred.

### 11 Shield Trust Review

- Sensitive actions can require second-device confirmation.
- User can revoke all agent permissions and trigger emergency lockdown.

### 12 Component Library

- Components are reusable and mapped to the contracts in `components.md`.

### 13 UX Stress Test Matrix

- Scenarios from `test-matrix.csv` are represented as design-review rows.

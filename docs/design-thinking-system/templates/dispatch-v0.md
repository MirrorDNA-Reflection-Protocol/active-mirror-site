# Dispatch v0

Use this to keep capture, execution, and approval separated across devices.

## v0 Device Roles

| Device/body | Role | Allowed by default |
| --- | --- | --- |
| OnePlus | Capture intent quickly | Notes, voice/text capture, lightweight triage |
| Mac Mini | Execute queued local/runtime work | Task queue, tools, vault, receipts |
| Pixel | Approve sensitive actions | Consent confirmations, action approvals |
| Browser | User-facing workspace | Reflection, working surfaces, receipts |

## Dispatch Flow

```text
Capture intent on OnePlus
  -> Normalize into task capsule
  -> Queue on Mac Mini
  -> ToolGraph and boundary check
  -> Execute safe local work
  -> Ask Pixel approval for sensitive action
  -> Write receipt
  -> Return result to browser workspace
```

## Task Capsule

| Field | Value |
| --- | --- |
| Captured by |  |
| Captured time |  |
| Raw intent |  |
| Normalized goal |  |
| Boundary |  |
| Approval class |  |
| Execution body |  |
| Approval body |  |
| Receipt target |  |

## Sensitive Approval Examples

- Sending messages.
- Publishing content.
- Deploying code.
- Changing infrastructure.
- Sharing personal or client context.
- Storing high-sensitivity memory.

## Receipt Fields

- Capture device.
- Execution body.
- Approval body.
- Tool route.
- Result.
- Memory decision.

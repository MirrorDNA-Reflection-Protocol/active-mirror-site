# Mirror ToolGraph Map / v0

Use this as the required record for every tool AMOS can call.

## Tool Record

| Field | Value |
| --- | --- |
| Tool name |  |
| Owner |  |
| Purpose |  |
| Inputs |  |
| Outputs |  |
| Permissions required |  |
| Data sensitivity | Public / working / personal / client / secret |
| Risk level | Low / medium / high / blocked |
| Can run offline | Yes / no |
| External network | Yes / no |
| Writes files | Yes / no |
| Sends messages | Yes / no |
| Changes infra | Yes / no |
| Approval class | Reflect / draft / prepare / act / block |
| Fallback |  |
| Test command |  |
| Health signal |  |
| Receipt fields |  |

## Route Rules

- No tool can run without a ToolGraph record.
- Tool purpose must be narrower than "do anything."
- Inputs and outputs must be typed in plain language.
- High-risk tools require explicit approval and postflight receipt.
- Secret-bearing tools must never expose secrets to the browser UI.

## Minimal JSON Shape

```json
{
  "name": "",
  "purpose": "",
  "inputs": [],
  "outputs": [],
  "permissions": [],
  "risk_level": "low",
  "approval_class": "reflect",
  "fallback": "",
  "test": "",
  "owner": ""
}
```

## Done Criteria

- Tool can be tested.
- Tool can fail closed.
- Tool can be disabled.
- Tool produces traceable evidence.

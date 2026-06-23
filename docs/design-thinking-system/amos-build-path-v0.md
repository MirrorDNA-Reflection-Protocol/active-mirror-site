# AMOS Build Path v0

This separates the runtime build from the public homepage and from design workshop artifacts.

The homepage is the product demo. AMOS is the execution layer behind the mirror.

## Build Components

| Component | Purpose | First implementation |
| --- | --- | --- |
| AMOS Control Plane v0 | Own runtime state, routing, allowed tools, vault access, and task queue | Mac Mini local runtime |
| Mirror ToolGraph v0 | Registry of every tool, permission, risk, fallback, test, and owner | Markdown + JSON registry |
| MirrorEval v0 | Human-on-the-Bridge style evaluator for agent actions | Jurors, traps, scoring, source rules |
| MirrorBench v0 | Real sessions converted into fail-to-pass task capsules | Local benchmark pack |
| MirrorSkills v0 | Small skill library for repeatable work | FEU, artifact, task capsule, boundary guard, source discipline, reset |
| Default Ledger v0 | Bounded defaults with visible override | Local ledger entries and receipts |
| Somatic Reset v0 | Drift reset without identity wipe | Reset flow + receipt |
| Dispatch v0 | Device/body split for capture, execution, and approval | OnePlus captures, Mac Mini executes, Pixel approves sensitive actions |

## Correct Build Order

1. Mirror ToolGraph v0
2. AMOS Control Plane v0
3. Default Ledger v0
4. MirrorEval v0
5. MirrorBench v0
6. MirrorSkills v0
7. Dispatch v0
8. Homepage/runtime integration

Reason: tools and permissions must exist before routing; defaults must exist before memory; evaluation must exist before broad agent action.

## System Boundary

| Surface | Job |
| --- | --- |
| Public homepage | Invite the user into one live reflection and show the receipt |
| Browser workspace | Let the user work privately, choose boundaries, and see generated surfaces |
| AMOS Control Plane | Route tasks, access allowed tools, schedule work, and write receipts |
| Local vault | Store approved context, receipts, defaults, and artifacts |
| Device approval | Capture intent and approve sensitive actions |

## First Local Architecture

```text
User intent
  -> Browser mirror
  -> Consent boundary
  -> Default Ledger check
  -> ToolGraph route
  -> AMOS task queue
  -> Model/tool execution
  -> MirrorEval
  -> Receipt
  -> Optional memory promotion
```

## Done Criteria for v0

- Every tool has a ToolGraph record.
- Every task has a receipt.
- Every memory promotion requires approval.
- Every external action has an approval class.
- Every high-risk output runs MirrorEval.
- Every repeated workflow can become a MirrorBench capsule before becoming a skill.
- Every drift reset preserves canonical identity and names what changed.
- Every device dispatch says who captured, who executed, and who approved.

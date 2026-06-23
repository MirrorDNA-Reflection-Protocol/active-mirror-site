# Skill Creation and Retirement Flow

Use this when a repeated workflow should become a small reusable skill, or when a skill should be retired.

## Creation Trigger

Create a skill only when:

- The workflow has repeated at least twice.
- The steps are stable enough to document.
- The input/output contract is clear.
- The failure modes are known.
- A test or checklist can verify it.

## Skill Spec

| Field | Value |
| --- | --- |
| Skill name |  |
| Purpose |  |
| Owner |  |
| Inputs |  |
| Outputs |  |
| Permissions |  |
| Risk level |  |
| Steps |  |
| Tests |  |
| Fallback |  |
| Receipt fields |  |
| Retirement trigger |  |

## Promotion Flow

```text
Observed repeat
  -> Draft skill
  -> Test on real task
  -> Role critique
  -> Add to ToolGraph or skill registry
  -> Use with receipt
  -> Review after failures
```

## Retirement Flow

Retire a skill when:

- It no longer matches the product direction.
- It causes repeated drift.
- It hides risk or approval boundaries.
- A safer system-level capability replaces it.
- Its tests no longer reflect real use.

## Retirement Receipt

- Skill retired.
- Why retired.
- Replacement path.
- Affected workflows.
- Archive location.

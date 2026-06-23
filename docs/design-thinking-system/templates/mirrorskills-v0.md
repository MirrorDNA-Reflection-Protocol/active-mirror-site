# MirrorSkills v0

Use this as the first small skill library for repeatable Active Mirror work.

## Skill List

| Skill | Purpose | Risk | Receipt |
| --- | --- | --- | --- |
| FEU | Split facts, estimates, and unknowns before action | Low | FEU table |
| Downloadable artifact | Turn output into a file the user can keep | Medium | File path and checksum if available |
| Codex task capsule | Package a bounded implementation task | Medium | Repo, files, tests, done condition |
| Separation guard | Detect and stop non-Active-Mirror lane drift | Low | Lane decision |
| Source discipline | Verify claims against source links or local evidence | Medium | Sources used and rejected |
| Reset | Stop drift and return to grounded objective | Low | Reset receipt |

## Skill Contract

Every skill needs:

- Purpose.
- Inputs.
- Outputs.
- Permissions.
- Failure mode.
- Test.
- Owner.
- Receipt fields.

## FEU Template

| Facts | Estimates | Unknowns |
| --- | --- | --- |
|  |  |  |

## Codex Task Capsule

```text
Repo:
Objective:
Files likely touched:
Do not touch:
Acceptance checks:
Source/evidence:
Rollback:
Done condition:
```

## Separation Guard

```text
Current lane:
Incoming task lane:
Agreement: yes/no
Decision:
```

## Promotion Rule

A skill graduates from v0 only after it succeeds on three real tasks and has one documented failure mode.

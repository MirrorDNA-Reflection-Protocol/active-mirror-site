# MirrorBench v0

Use this to convert real Active Mirror sessions into verifiable task capsules.

## Purpose

Build a local benchmark from real work so MirrorEval, MirrorSkills, and AMOS can improve without relying on vague impressions.

## Task Capsule

| Field | Value |
| --- | --- |
| Capsule ID |  |
| Source session |  |
| User goal |  |
| Task class | Decide / research / draft / build / review / reset / artifact |
| Skill subclass |  |
| Input fixtures |  |
| Allowed tools |  |
| Blocked tools |  |
| Consent boundary |  |
| Hard rules |  |
| Expected artifact |  |
| Pass condition |  |
| Fail condition |  |
| Eval profile |  |
| Cost/runtime budget |  |
| Privacy notes |  |

## Fail-To-Pass Test

```text
Before:
  Expected failure:

After:
  Expected pass:

Evidence required:
```

## Capsule Construction Flow

```text
Real session
  -> Remove sensitive context
  -> Recover fixtures
  -> Rewrite prompt into task capsule
  -> Define hard rules
  -> Define semantic rubric
  -> Define expected artifact
  -> Run failure baseline
  -> Run repaired route
  -> Store receipt
```

## Scoring Dimensions

| Dimension | Question |
| --- | --- |
| Goal completion | Did it move the stated goal forward? |
| Artifact delivery | Was the expected artifact produced? |
| Source discipline | Are claims backed or marked unknown? |
| Boundary discipline | Was excluded context actually excluded? |
| Tool discipline | Were only allowed tools used? |
| Recovery | Did it handle missing or blocked tools? |
| Cost/runtime | Was execution reasonable for the task? |
| Memory decision | Was memory promotion correct? |

## Done Criteria

- Capsule can run without private leakage.
- Capsule has a pass/fail condition.
- Capsule has a receipt.
- Capsule can train or evaluate a future MirrorSkill.

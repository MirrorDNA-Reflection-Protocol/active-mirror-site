# Drift Reset / Somatic Reset Flow / v0

Use this when the conversation, product, code, or user focus is drifting.

## Purpose

Reset drift without wiping canonical identity, useful context, or approved memory.

## Drift Triggers

- The task switches lanes without confirmation.
- Internal architecture language replaces user-facing clarity.
- The system proposes broad OS-level work when the immediate goal is a page, copy, or test.
- Memory is used as certainty without verification.
- The agent keeps expanding tools instead of finishing the smallest useful slice.
- The user asks "what else" repeatedly and the work loses a done condition.

## Reset Flow

```text
Pause
  -> Name the drift
  -> Restate the grounded objective
  -> Split FEU: Facts, Estimates, Unknowns
  -> Reconfirm boundary
  -> Choose the smallest next action
  -> Continue
  -> Receipt the reset
```

## Reset Prompt

```text
Drift check:
We are moving away from [grounded objective].
Facts:
Estimates:
Unknowns:
Smallest next action:
```

## Somatic Reset for the Human

This is not therapy and does not infer private state. It is a practical pause.

- Stop adding scope for one turn.
- State the exact work surface.
- Choose one visible output.
- Decide what waits.
- Resume only after the next action is clear.

## Receipt Fields

- Drift trigger.
- Objective restated.
- Scope removed.
- Boundary confirmed.
- Next action chosen.

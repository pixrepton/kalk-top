---
name: kalk-top-debug-repro-loop
description: Uses an evidence-first loop for difficult kalk-top bugs. Use when a bug is reproducible but the root cause is unclear, especially for runtime, timing, or state-sync issues.
---

# Debug Repro Loop

## Use when

- the bug is reproducible
- the root cause is unclear
- normal read-and-patch attempts are failing

## Inputs

- symptom
- exact repro steps
- expected behavior
- actual behavior

## First reads

1. `AGENTS.md`
2. `memory-bank/current-state.md`
3. `memory-bank/open-questions.md`
4. `docs/discovery/repo-discovery.md`

## Preferred tools

- Debug Mode first
- Browser when UI or network behavior matters
- targeted file reading only after evidence is captured

## Invariants

- expected vs actual is explicit
- repro steps are explicit
- evidence is collected before the fix
- instrumentation is removed after the fix is verified

## Output format

Return exactly:

```markdown
repro:
hypotheses:
evidence:
root-cause:
fix-target:
verify-next:
```

## Failure handling

If the bug is not reproducible, stop and ask for a better repro instead of inventing a fix.

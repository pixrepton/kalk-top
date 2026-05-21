---
name: kalk-top-ui-runtime-check
description: Verifies visible kalk-top behavior through Browser, console, network, and runtime evidence. Use for UI changes, flow regressions, results screens, or visual behavior that needs proof.
---

# UI Runtime Check

## Use when

- visible behavior changed
- a form or configurator flow needs verification
- a results or completion screen needs proof
- console or network evidence matters

## Inputs

- page or route
- target flow
- expected visible behavior

## First reads

1. `AGENTS.md`
2. `memory-bank/current-state.md`
3. `docs/runbooks/manual-runtime-setup.md`
4. relevant local UI instructions under `kalkulator/AGENTS.md` or `konfigurator/AGENTS.md`

## Preferred tools

- Browser first
- console and network inspection
- screenshots for visible state confirmation

## Invariants

- the tested flow is explicit
- visible result is checked
- console or network evidence is captured if relevant
- the answer distinguishes verified behavior from unverified assumptions

## Output format

Return exactly:

```markdown
checked-flow:
visible-result:
console-network:
evidence:
regression-risk:
next-action:
```

## Failure handling

If the page cannot be reached or the runtime is unavailable, stop and state the missing runtime prerequisite.

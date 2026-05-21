---
name: kalk-top-change-surface-map
description: Maps the real change surface of a proposed kalk-top modification across layers, contracts, runtime paths, and downstream repos. Use before starting complex or cross-cutting work.
---

# Change Surface Map

## Use when

- a change may cross multiple layers
- the likely blast radius is unclear
- you want to know what must be reviewed before coding

## Inputs

- proposed change
- affected subsystem
- optional target files

## First reads

1. `AGENTS.md`
2. `memory-bank/current-state.md`
3. `docs/architecture/change-surface-checklist.md`
4. `docs/architecture/boundary-map.md`
5. `docs/contracts/dto-and-boundaries.md`

## Preferred tools

- targeted `rg`
- targeted `ReadFile`
- use discovery skill if the code path is still unclear

## Invariants

- list touched layers
- list touched contracts
- list touched runtime surfaces
- list downstream impact

## Output format

Return exactly:

```markdown
touched-layers:
touched-contracts:
touched-runtime:
downstream-impact:
review-before-build:
```

## Failure handling

If the proposal is too vague to map, stop and say what must be specified first.

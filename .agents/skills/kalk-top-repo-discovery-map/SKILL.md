---
name: kalk-top-repo-discovery-map
description: Maps unfamiliar work to the correct kalk-top source of truth, edit points, forbidden layers, and verification path. Use when starting bugfixes, refactors, or feature work in unfamiliar areas.
---

# Repo Discovery Map

## Use when

- starting unfamiliar work
- locating the true edit point
- deciding which layer owns behavior

## Inputs

- task summary
- touched area
- optional symptom

## First reads

1. `AGENTS.md`
2. `memory-bank/project-brief.md`
3. `memory-bank/current-state.md`
4. `docs/discovery/repo-discovery.md`

## Preferred tools

- targeted `rg`
- targeted `ReadFile`
- avoid broad rediscovery when a local path is already known

## References

- `references/ownership-map.md`

## Invariants

- identify the source of truth
- list likely edit points
- call out forbidden layers
- name the next verification step

## Output format

Return exactly:

```markdown
source-of-truth:
likely-edit-points:
forbidden-layers:
verify-next:
```

## Failure handling

If ownership is unclear, stop and escalate instead of guessing.

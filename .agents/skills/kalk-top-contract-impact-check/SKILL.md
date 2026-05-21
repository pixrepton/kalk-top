---
name: kalk-top-contract-impact-check
description: Checks contract and integration impact for kalk-top changes. Use when touching CalcRequestDTO, OfferDTO, REST routes, auth, trace semantics, generator integration, or mail-ingress workflow.
---

# Contract Impact Check

## Use when

- DTO shape changes
- REST request or response changes
- auth or trace semantics change
- generator or mail-ingress integration changes

## Inputs

- changed files
- proposed contract change
- user goal

## First reads

1. `AGENTS.md`
2. `memory-bank/current-state.md`
3. `docs/contracts/dto-and-boundaries.md`
4. `docs/contracts/field-mapping.md`
5. `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`
6. `docs/ecosystem/TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md`

## Preferred tools

- targeted `ReadFile`
- targeted `rg`
- use broad exploration only if producer-consumer flow is unclear

## References

- `references/checklist.md`

## Invariants

- identify producer and consumer paths
- name affected downstream repos
- decide whether ecosystem docs must change
- do not guess on ownership

## Output format

Return exactly:

```markdown
scope:
affected-boundaries:
downstream-impact:
docs-update-required:
open-risks:
```

## Failure handling

If the producer-consumer path is unclear, stop, say what is unclear, and add the uncertainty to `memory-bank/open-questions.md`.

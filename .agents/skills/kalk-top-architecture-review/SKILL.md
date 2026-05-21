---
name: kalk-top-architecture-review
description: Reviews architectural changes in kalk-top against ownership, boundaries, contracts, rollback, and verification. Use before or after multi-file design changes, integration changes, or backend-vs-frontend authority decisions.
---

# Architecture Review

## Use when

- a task changes multiple layers
- a design choice affects DTOs, REST, or runtime boundaries
- you want an architecture sanity check before implementation

## Inputs

- task summary
- proposed change
- affected files or subsystems

## First reads

1. `AGENTS.md`
2. `memory-bank/current-state.md`
3. `memory-bank/decisions.md`
4. `docs/architecture/repo-rules.md`
5. `docs/architecture/boundary-map.md`
6. `docs/architecture/decision-criteria.md`

## Preferred tools

- targeted `ReadFile`
- targeted `rg`
- Plan Mode when the change is still undecided

## Invariants

- ownership is explicit
- canonical source of truth is preserved
- contract risk is named
- rollback path exists
- verification path exists

## References

- `references/review-checklist.md`

## Output format

Return exactly:

```markdown
architecture-fit:
boundary-risks:
contract-risks:
rollback-path:
verify-path:
recommendation:
```

## Failure handling

If the proposed change is not yet concrete enough to review, say what is missing and route into Plan Mode.

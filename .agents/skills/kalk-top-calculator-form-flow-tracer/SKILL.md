---
name: kalk-top-calculator-form-flow-tracer
description: Traces kalk-top calculator and configurator issues across form state, DTO mapping, backend offer generation, and result rendering. Use for field gating, state sync, or frontend-vs-backend source-of-truth issues.
---

# Calculator Form Flow Tracer

## Use when

- field gating is wrong
- state does not persist correctly
- frontend and backend disagree
- result rendering does not match submitted input

## Inputs

- symptom
- affected field or screen
- optional payload or traceId

## First reads

1. `AGENTS.md`
2. `memory-bank/current-state.md`
3. `docs/contracts/field-mapping.md`
4. `docs/discovery/repo-discovery.md`

## Preferred tools

- targeted tracing with `rg`
- targeted `ReadFile`
- follow the path across form, mapper, backend use case, and renderer

## References

- `references/trace-order.md`

## Invariants

- identify the true source of truth
- trace the gating or mapping path
- state whether frontend or backend is authoritative at the failing point
- name the next verification step

## Output format

Return exactly:

```markdown
symptom:
trace-path:
source-of-truth:
breakpoint:
verify-next:
```

## Failure handling

If evidence splits between legacy and backend-first paths, preserve that conflict explicitly instead of collapsing it.

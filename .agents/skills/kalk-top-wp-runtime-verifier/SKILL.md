---
name: kalk-top-wp-runtime-verifier
description: Verifies kalk-top WordPress runtime wiring, preflight routes, auth, and runtime checks. Use for setup issues, route failures, auth failures, or runtime smoke verification.
---

# WP Runtime Verifier

## Use when

- runtime route is failing
- auth or nonce path is unclear
- preflight or smoke verification is needed
- setup or environment wiring is suspect

## Inputs

- base URL
- route
- environment
- available auth material
- symptom

## First reads

1. `AGENTS.md`
2. `memory-bank/current-state.md`
3. `docs/runbooks/manual-runtime-setup.md`
4. relevant `wp-adapter/rest/*` files

## Preferred tools

- targeted runtime-safe requests
- existing harnesses and npm scripts
- browser/runtime inspection only when needed

## References

- `references/runtime-checks.md`

## Invariants

- route existence is checked
- auth path is understood
- something was actually run
- result is classified as config, auth, routing, validation, or downstream issue

## Output format

Return exactly:

```markdown
checked:
ran:
evidence:
classification:
next-action:
```

## Failure handling

If access, credentials, or runtime prerequisites are missing, stop and state exactly what is missing.

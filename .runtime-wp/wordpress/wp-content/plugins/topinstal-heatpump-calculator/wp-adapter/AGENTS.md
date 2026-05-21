# WP Adapter Instructions

## Scope

This directory owns WordPress runtime integration: REST routes, auth, logging, repositories, workflow bridges, and operational diagnostics.

## Always true here

- Runtime concerns belong here, not in `core/domain`
- REST contract changes may have ecosystem impact
- Mail-ingress and generator integrations must be treated as cross-boundary changes
- Evidence matters: prefer preflight routes, diagnostics, and harnesses over guessing

## Preferred tools and paths

- Runtime checks: `docs/runbooks/manual-runtime-setup.md`
- Ecosystem checks: `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`
- Boundary checks: `docs/contracts/dto-and-boundaries.md`

## Verify after changes here

- `npm run test:rest` when REST behavior changes
- `npm run test:mail-ingress-workflow` for workflow changes
- `npm run test:mail-ingress-live` only when live runtime access is intended

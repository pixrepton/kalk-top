# Migration Plan

## Objective

Maintain and complete the backend-first operating model without breaking rollout safety, runtime diagnostics, or rollback paths.

## Current migration priorities

1. Keep discovery, contract mapping, and canonical docs current
2. Preserve secret rotation and lock-worker improvements
3. Preserve healthcheck and workflow diagnostics paths
4. Keep evidence retention, DLQ, retry, and operator review flows coherent
5. Keep verification surfaces runnable during refactors

## Rollback and safety

- Preserve runtime flags such as:
  - `topinstal_agent_lock_v2_enabled`
  - `topinstal_agent_healthcheck_enabled`
  - `topinstal_agent_secret_rotation_enabled`
  - `topinstal_agent_retention_enabled`
  - `USE_BACKEND_CALC` or equivalent backend-first gate
- Rollback should prefer flag changes over architectural reversals

## Verification gates

- `npm run verify`
- `npm run test:contract`
- `npm run test:fixtures`
- `npm run test:mail-ingress-workflow`
- `npm run test:rest`
- `npm run test:mail-ingress-live`

## Working rule

Treat this file as the current roadmap for safe evolution, not as a place for long historical migration narrative.

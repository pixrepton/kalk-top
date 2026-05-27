# verify-pack

Run a **tiered** local verification pack. Prefer `npm run proof` before deploy; use lighter tiers for narrow edits.

## Full gate (deploy / kalkulator + konfigurator)

```powershell
npm run proof
```

= `verify:engine` + `verify:ui:critical` + `verify:ui:soft` (soft non-blocking on PDF skip).

## Engine only (no browser)

1. `npm run verify:engine` (alias `npm run verify`)
2. Report: **confirmed locally** / **skipped** / **failed**

## UI critical only

```powershell
npm run verify:ui:critical
```

Covers: smoke, finish CTA, configurator pump step, business personas, form validation gate.

## UI soft

```powershell
npm run verify:ui:soft
```

Covers: full journey (PDF soft), hydraulics layout, mobile finish.
If `TOPINSTAL_REST_BASE_URL` set: optional `test:rest` (failures logged, non-blocking).

## Narrow checks

- Offer boundary: `npm run test:contract` + `npm run test:fixtures` + `npm run test:production-shape`
- Single E2E: `npm run test:e2e:finish`, `test:e2e:smoke`, `test:e2e:journey`
- MCP: `runtime_preflight_reference` on `kalk-top-repo-assistant` when runtime wiring is in scope

Report each step: **confirmed locally** / **skipped** / **failed**.

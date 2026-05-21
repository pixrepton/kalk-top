# Repo Rules

> Status: canonical
> Owner: kalk-top repo governance
> Last verified against code/runtime: 2026-04-02 (documentation governance pass)
> Source-of-truth level: L1
> Supersedes: none
> Related docs: `docs/SOURCE_OF_TRUTH_INDEX.md`, `docs/AGENT_EXECUTION_STANDARD.md`, `docs/architecture/boundary-map.md`

## Mission

`kalk-top` is the TOP-INSTAL decision layer. The repo owns HVAC calculation, pump selection, buffer, pricing, and offer generation.

## Canonical boundary

- Primary system boundary: `POST /wp-json/topinstal/v1/calculate-offer`
- Canonical transformation: `CalcRequestDTO -> OfferDTO`
- Frontend should collect data and render results, not become the engineering source of truth

## Layer rules

### `core/domain`

- Pure engineering logic only
- No WordPress, DOM, fetch, DB, PDF, or mail concerns
- No UI labels or presentation text

### `core/application`

- Orchestrates use cases, validation, and assembly of the final offer
- May call repositories or ports
- Must not render UI or own transport concerns

### `wp-adapter`

- Owns REST, WP runtime, nonces, logging, caching, mail, and persistence integration
- Is the only layer allowed to depend on WP runtime APIs

### `frontend`, `kalkulator`, `konfigurator`

- Own UI collection, state transitions, and result rendering
- Must not silently replace the backend as the calculation authority

## Hard bans

- No WP, UI, DB, PDF, or mail code in `core/*`
- No mutable "golden object" shared across many steps
- No calculation logic moved into generator or mail-ingress
- No contract changes without explicit downstream impact check

## Data and contract rules

- **Pricing and commercial catalog:** `core/infrastructure/master-data/equipment-catalog.json` is the single source of truth for amounts that feed `OfferDTO` (via `PricingEngine`). Do not introduce a second editable price table in `konfigurator/` or `kalkulator/` except derived/preview helpers that read the same JSON.
- **Configurator presentation:** `konfigurator/configurator-presentation.json` is for UI copy and asset names only; it is loaded at runtime when possible (`loadPresentationData`). Pump technical specs stay in `konfigurator/panasonic.json`.
- Use DTO boundaries: `CalcRequestDTO -> OfferDTO`
- Preserve `schemaVersion` and `traceId`
- Treat DTOs as snapshots, not ad hoc containers
- Prefer reason codes and structured fields over UI-specific strings

## Runtime and rollback

- Keep rollback paths such as `USE_BACKEND_CALC` intact when changing runtime behavior
- Do not break backend-first flow when touching legacy compatibility seams

## Verification defaults

- Broad check: `npm run verify`
- Contract boundary: `npm run test:contract`, `npm run test:fixtures`
- REST boundary: `npm run test:rest` (requires `TOPINSTAL_REST_BASE_URL`; optional in `npm run verify` via `verify:rest-optional`)
- Engine parity: `npm run test:engine-parity` (touching domain engines or canonical JS parity paths)
- Mail-ingress workflow scripts in **this** repo (`npm run test:mail-ingress-workflow`, `npm run test:mail-ingress-live`) are **stub pointers**; real integration/live smoke runs in the `topinstal-mail-ingress` package

## Related docs

- Discovery: `docs/discovery/repo-discovery.md`
- Contracts: `docs/contracts/field-mapping.md`, `docs/contracts/dto-and-boundaries.md`
- Plan: `docs/plans/migration-plan.md`

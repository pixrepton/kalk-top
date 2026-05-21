# Repo Discovery

## Freshness

- Last refreshed: 2026-04-14
- Canonical workspace: repo root
- Runtime mirror: `.runtime-wp/wordpress/wp-content/plugins/topinstal-heatpump-calculator/` (link-based view of repo root via `npm run runtime:sync`)

## Entrypoints

- Main bootstrap: `heatpump-calculator.php`
- REST route registration: `wp-adapter/bootstrap/routes.php`
- Mail-ingress runtime bootstrap: `wp-adapter/agents/bootstrap.php`

## Core execution areas

- Use case orchestration: `core/application/CalculateOfferUseCase.php` (class `TopInstal_CalculateOffer_UseCase`)
- Domain engines: `core/domain/ozc/OzcEngine.php` (m.in. `TopInstal_OzcEngine`, `TopInstal_OzcEngine_Full`, `TopInstal_OzcEngine_JsReference`), `core/domain/selection/*`, `core/domain/buffer/*`, `core/domain/pricing/*`
- Contracts: `core/contracts/CalcRequestDTO.js`, `OfferDTO.js`, `ReasonCodes.*`, `OZC_*_REQUIREMENTS.md`
- REST adapters: `wp-adapter/rest/*`
- Mail-ingress workflow: canonical ownership now lives under `gmail-agent/wp-adapter/mail-ingress/*`; outer-root `wp-adapter/mail-ingress/*` is compatibility-only
- UI state and flow: `kalkulator/*` (w tym `kalkulator/js/offerProjection/` jako warstwa projekcji oferty), wspoldzielone `frontend/api/*`, `konfigurator/*`

## Canonical flows today

### Offer calculation

- request enters via `POST /wp-json/topinstal/v1/calculate-offer`
- request is validated and transformed into `CalcRequestDTO`
- `CalculateOfferUseCase` orchestrates domain engines and returns `OfferDTO`

### Mail-ingress workflow

- ingress data is fetched and normalized
- `CieploResultToCalcRequestMapper.php` builds the request shape
- `CalcRequestExecutionService.php` runs the offer calculation without self-HTTP
- generator integration is triggered downstream when needed

### Calculator UI

- UI state is collected in `kalkulator/`; shared request shaping also uses `frontend/api/mapUiStateToCalcRequestDTO.js` (runtime loads the shared mapper from the plugin bootstrap)
- mapping bridges UI state into request DTO shape
- backend result is rendered back into UI; offer business data is projected through `kalkulator/js/offerProjection/` for summary, header, PDF, and email payloads when backend `OfferDTO` is present

## Offer PDF generator bootstrap

- Loader: `wp-adapter/bootstrap/offer-documents.php`
- Compatibility wrappers (multi-path fallback + in-repo class fallback):
  - `wp-adapter/mail-ingress/WorkflowConfig.php` → tries `kalk-top/gmail-agent/` then sibling `../gmail-agent/`, then defines `TopInstal_MailIngressWorkflowConfig` locally
  - `wp-adapter/mail-ingress/OfferDocumentsGeneratorClient.php` → same multi-path logic for `TopInstal_OfferDocumentsGeneratorClient`
- Availability probe: `scripts/probes/offer-doc-client-probe.php`
- AJAX handler: `HeatPump_Calculator::ajax_generate_offer_document()` in `heatpump-calculator.php`

## Panasonic catalog pipeline (new in 2026-04-14)

- Source PDFs: `panasonic/`
- Extraction pipeline (v2, profiled): `scripts/panasonic_catalog_extract_v2.py`
- Validation: `scripts/panasonic_catalog_validate.py`
- Golden test: `tests/fixtures/panasonic_catalog_golden_test.py`
- Schemas: `schemas/panasonic_*.schema.json`
- Data layers: `data/raw/`, `data/normalized/`
- Memory: `memory/entities/`, `memory/relations/`, `memory/facts/`
- Knowledge: `knowledge/panasonic/`
- Context: `context/llm/`, `context/offering/`, `context/service/`, `context/selection/`, `context/pricing/`
- Reports: `reports/panasonic_*`
- Update workflow: `docs/panasonic_catalog_update_workflow.md`

## Operational hotspots

- backend feature flag and legacy seam: `USE_BACKEND_CALC`
- workflow preflight route: `/wp-json/topinstal/v1/mail-ingress/workflow-preflight`
- runtime diagnostics and admin surfaces live in WP adapter and admin bootstrap areas

## Discovery rule

Use repo root files as the source of truth for edits. Treat `.runtime-wp/` as inspection and runtime verification material unless explicitly told otherwise.

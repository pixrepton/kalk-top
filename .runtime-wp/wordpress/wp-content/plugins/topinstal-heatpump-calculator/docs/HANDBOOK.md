# Handbook

> Status: operational
> Owner: TOP-INSTAL documentation governance
> Last verified against code/runtime: 2026-04-14 (offer PDF bootstrap and Panasonic catalog additions)
> Source-of-truth level: L2
> Supersedes: none
> Related docs: `docs/SOURCE_OF_TRUTH_INDEX.md`, `docs/READ_PRIORITY_MATRIX.md`, `docs/AGENT_EXECUTION_STANDARD.md`

## Purpose

This handbook is the practical operator and contributor guide for `kalk-top`.

Use it when you need a quick, current picture of:

- what the repo owns
- how the main workflow runs
- where to edit logic
- what to verify after changes
- which documents are canonical

## Read discipline

Before using this handbook as authority, check:

1. [SOURCE_OF_TRUTH_INDEX.md](SOURCE_OF_TRUTH_INDEX.md)
2. [READ_PRIORITY_MATRIX.md](READ_PRIORITY_MATRIX.md)

This handbook is a fast operational guide, not the strongest authority for contracts or runtime semantics.

## Repo role

`kalk-top` is the TOP-INSTAL decision layer.

Canonical backend contract:

- input: `CalcRequestDTO`
- route: `POST /wp-json/topinstal/v1/calculate-offer`
- output: `OfferDTO`

Backend-first flow is the default operating model. The browser prepares requests and renders results; backend use cases and domain engines produce the authoritative offer data.

## Main runtime workflow

1. UI or configurator gathers state.
2. Frontend mapping builds `CalcRequestDTO`.
3. REST controller validates and normalizes the request.
4. `CalculateOfferUseCase` orchestrates calculation.
5. Domain engines compute OZC, selection, buffer, and pricing.
6. Backend returns `OfferDTO`.
7. UI, generator, and mail-ingress follow-up consume the structured result.

Detailed walkthrough:

- [architecture/APPLICATION_WORKFLOW_AND_ENGINES_README.md](architecture/APPLICATION_WORKFLOW_AND_ENGINES_README.md)

## Ownership by layer

- `core/domain`
  - engineering logic only
  - no WordPress, UI, PDF, or mail runtime ownership
- `core/application`
  - orchestration from request to offer
- `wp-adapter`
  - REST, validation, repositories, logging, integration wiring
- `frontend`, `kalkulator`, `konfigurator`
  - browser DTO mapping, UI state, rendering
- `docs`
  - canonical repo documentation

## Current engine stance

### OZC

- backend OZC is authoritative unless trusted `ozcResult` is intentionally supplied
- Full OZC bridge exposes audit data for defaults, methods, warnings, and sanity flags
- annual energy is documented as heuristic HDD-based output, not canonical design-load truth

### Selection / Buffer / Pricing

- backend engines keep public contracts stable
- canonical JS behavior patterns are preserved through parity harnesses where applicable
- backend offer output remains the single runtime truth for the official offer

## Mail-ingress boundary

Gmail polling runtime is no longer owned by WordPress in this repo.

`topinstal-mail-ingress` owns:

- Gmail polling
- message detection
- email parsing
- transport idempotency
- dispatch to `kalk-top`
- mark processed

`kalk-top` owns the backend workflow after dispatch.

Current operational note:


## Common edit points

### Backend orchestration

- `core/application/CalculateOfferUseCase.php`

### Domain engines

- `core/domain/ozc/OzcEngine.php`
- `core/domain/selection/SelectionEngine.php`
- `core/domain/buffer/BufferEngine.php`
- `core/domain/pricing/PricingEngine.php`

### REST boundary

- `wp-adapter/rest/CalculateOfferController.php`
- `wp-adapter/rest/RequestValidator.php`

### Frontend DTO mapping

- `frontend/api/mapUiStateToCalcRequestDTO.js`
- `frontend/api/topinstalApi.js`
- `kalkulator/js/mapUiStateToCalcRequestDTO.js` (runtime copy kept in sync; verify loads shared `frontend/api/` path via bootstrap)

### Offer projection (UI / PDF / email)

- `kalkulator/js/offerProjection/*`

### Configurator behavior

- `konfigurator/configurator-unified.js`

## Verification defaults

Use the lightest relevant verification first.

Broad repo checks:

```powershell
npm run verify
```

Offer-boundary checks:

```powershell
npm run test:contract
npm run test:fixtures
```

REST verification:

```powershell
$env:TOPINSTAL_REST_BASE_URL = "https://twoja-domena.pl"
$env:TOPINSTAL_REST_NONCE = "twoj_nonce"
npm run test:rest
```

Targeted backend harnesses:

- `core/application/harness/`

Engine parity (PHP vs canonical JS reference, run when changing OZC/selection/buffer/pricing behavior):

```powershell
npm run test:engine-parity
```

## Documentation map

Start:

1. [../README.md](../README.md)
2. [SOURCE_OF_TRUTH_INDEX.md](SOURCE_OF_TRUTH_INDEX.md)
3. [READ_PRIORITY_MATRIX.md](READ_PRIORITY_MATRIX.md)
4. [architecture/repo-rules.md](architecture/repo-rules.md)
5. [overview/README_TOP-INSTAL_HVAC_Calculator.md](overview/README_TOP-INSTAL_HVAC_Calculator.md)
6. [architecture/APPLICATION_WORKFLOW_AND_ENGINES_README.md](architecture/APPLICATION_WORKFLOW_AND_ENGINES_README.md)

Per-layer deep dives (under `docs/overview/`):

- [Core](overview/README_TOP-INSTAL_HVAC_Calculator_Core.md) · [WP Adapter](overview/README_TOP-INSTAL_HVAC_Calculator_WP-Adapter.md) · [Kalkulator](overview/README_TOP-INSTAL_HVAC_Calculator_Kalkulator_Layer.md) · [Konfigurator](overview/README_TOP-INSTAL_HVAC_Calculator_Konfigurator.md) · [Frontend API](overview/README_TOP-INSTAL_HVAC_Calculator_Frontend_API_Layer.md)

Then branch by task:

- contracts and payloads
  - [contracts/dto-and-boundaries.md](contracts/dto-and-boundaries.md)
  - [contracts/field-mapping.md](contracts/field-mapping.md)
  - [contracts/payload-field-classification.md](contracts/payload-field-classification.md)
- runtime and setup
  - [runbooks/manual-runtime-setup.md](runbooks/manual-runtime-setup.md)
  - [runbooks/REST_AUTH_AND_AGENT_KEY_VERIFICATION.md](runbooks/REST_AUTH_AND_AGENT_KEY_VERIFICATION.md)
  - [runbooks/PDF_CONVERTER_RUNTIME_VERIFICATION.md](runbooks/PDF_CONVERTER_RUNTIME_VERIFICATION.md)
- ecosystem and downstream impact
  - [ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md](ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md)
  - [ecosystem/TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md](ecosystem/TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md)

Historical material:

- [archive/README.md](archive/README.md)

## Offer PDF generator integration

The offer PDF download flow goes through:

1. Frontend button → `topinstalApi.generateOfferDocument(...)` → `POST /wp-admin/admin-ajax.php` (`action=heatpump_generate_offer_document`)
2. `HeatPump_Calculator::ajax_generate_offer_document()` → validates nonce, extracts `offerDto`
3. `TopInstal_OfferDocumentsGeneratorClient::generate(...)` → HTTP call to `top-instal-generator`
4. Generator returns `document.downloadUrl`; frontend triggers download

Generator client bootstrap is in `wp-adapter/bootstrap/offer-documents.php` (loads wrappers), which include `wp-adapter/mail-ingress/WorkflowConfig.php` and `OfferDocumentsGeneratorClient.php`. These are multi-path wrappers with in-repo fallback definitions — they work whether or not the `gmail-agent/` workspace tree is present.

Availability probe: `php scripts/probes/offer-doc-client-probe.php`

## Panasonic product catalog

A structured product/price catalog is extracted from `panasonic/Panasonic_cennik_pompy_ciepla_03.2026.pdf` (Schiessl, 03.2026).

Canonical data is in `data/normalized/catalog_items.jsonl` (237 records, 10 categories). To re-extract after a PDF update:

```powershell
python scripts/panasonic_catalog_extract_v2.py --pdf "panasonic/<file>.pdf"
python scripts/panasonic_catalog_validate.py
python tests/fixtures/panasonic_catalog_golden_test.py
```

Full workflow: [panasonic_catalog_update_workflow.md](panasonic_catalog_update_workflow.md)

## Notes on historical documents

- Legacy root filenames are listed in **`COMPAT_POINTERS.md`** at the repo root.
- Historical runtime reports and migration execution notes were moved out of active `docs/` paths into `docs/archive/`.
- Active docs should describe current runtime behavior, not transitional behavior that has already been retired.

# TOP-INSTAL HVAC Calculator

> Status: operational
> Owner: kalk-top maintainers
> Last verified against code/runtime: 2026-04-03 (classification reconciliation pass)
> Source-of-truth level: L2 - orientation overview; use authority docs for contracts and governance
> Supersedes: none
> Related docs: `../SOURCE_OF_TRUTH_INDEX.md`, `../READ_PRIORITY_MATRIX.md`, `../architecture/repo-rules.md`, `../contracts/dto-and-boundaries.md`

This document is an orientation layer for humans and agents. It summarizes the repo well, but it does not override canonical contract, architecture, or governance docs.

`kalk-top` is the TOP-INSTAL decision layer. This repository is the source of truth for HVAC calculation, selection, buffer sizing, pricing, and offer generation data exposed through the backend-first contract:

`CalcRequestDTO -> POST /wp-json/topinstal/v1/calculate-offer -> OfferDTO`

## What this repo owns

- backend calculation and offer assembly
- OZC / heat-loss logic
- heat pump selection logic
- hydraulics and buffer recommendation logic
- pricing logic and offer totals
- WordPress REST runtime, validation, repositories, and operational adapters
- browser-side DTO mapping and UI rendering that consume backend results

This repo does not own:

- Gmail polling runtime and transport idempotency after mail-ingress extraction
- document rendering as a source of business logic
- external knowledge / RAG explanation as a source of calculation truth

## Current architecture

The application is backend-first. The browser collects form/configurator state, maps it into `CalcRequestDTO`, and sends it to the backend. The backend validates the payload, resolves OZC, selection, buffer, and pricing, then returns `OfferDTO`.

```text
Form UI / Configurator
-> frontend DTO mapping
-> CalcRequestDTO
-> WP REST controller
-> RequestValidator
-> CalculateOfferUseCase
-> OzcEngine / SelectionEngine / BufferEngine / PricingEngine
-> OfferDTO
-> UI rendering / generator / mail-ingress follow-up
```

The public contract still intentionally allows a trusted `ozcResult` to be supplied. When present and valid, the backend can reuse that result instead of recomputing OZC.

## Canonical workflow

### 1. Frontend state and request assembly

- `frontend/api/mapUiStateToCalcRequestDTO.js` maps browser state into a stable request DTO.
- `frontend/api/topinstalApi.js` sends the request to `POST /wp-json/topinstal/v1/calculate-offer`.
- `kalkulator/` and `konfigurator/` render the result, but active runtime no longer relies on local legacy calculation fallbacks as a source of truth.

### 2. REST and validation

- `wp-adapter/rest/CalculateOfferController.php` handles auth, normalization, and response shaping.
- `wp-adapter/rest/RequestValidator.php` validates `CalcRequestDTO`, area constraints, DHW rules, and optional external `ozcResult`.

### 3. Application orchestration

- `core/application/CalculateOfferUseCase.php` is the single backend orchestrator.
- It resolves source inputs, runs the domain engines, merges warnings/assumptions, and returns `OfferDTO`.

### 4. Domain engines

- `core/domain/ozc/OzcEngine.php`
- `core/domain/selection/SelectionEngine.php`
- `core/domain/buffer/BufferEngine.php`
- `core/domain/pricing/PricingEngine.php`

### 5. Downstream consumers

- UI summary and configurator
- `top-instal-generator`
- `topinstal-mail-ingress`
- internal admin/review workflows

## Engine notes

### OZC

- Full OZC bridge is hardened against sparse or malformed temperature input.
- `indoor_temperature` fallback handling is explicit and audited.
- `engineering.ozc.audit` carries defaults, method markers, warnings, and sanity flags.
- `annual_energy` is explicitly marked as heuristic HDD-based output, not canonical design-load truth.
- `energy_losses` now preserves a physical-loss balance instead of mixing additive heuristics into percentage buckets.

### Selection

- Backend selection remains compatible with the public API contract.
- PHP behavior is aligned against canonical JS selection behavior through parity harnesses.

### Buffer

- Backend buffer logic is aligned against canonical JS behavior while keeping backend contracts unchanged.
- Current runtime still treats backend output as the authoritative offer result.

### Pricing

- Backend pricing stays contract-compatible and resolves commercial output into structured `OfferDTO.pricing`.
- Pricing behavior is also covered by JS-vs-PHP parity verification where canonical frontend behavior exists.

## Recent cleanup highlights

The current documentation reflects the cleanup and hardening work completed in the recent refactor cycle:

- active local calculator fallback was removed from runtime truth paths
- configurator no longer falls back to legacy pricing snapshots as the official offer source
- `lastCalculationResult` and similar global fallback seams were removed from active frontend offer consumption
- Full OZC bridge now exports richer audit diagnostics
- JS-vs-PHP parity harnesses were added for canonical engine behavior
- backend defaults for OZC location semantics were aligned between parity and Full OZC paths

Detailed technical rationale, before/after behavior, and implementation notes live here:

- [Application Workflow And Engines README](../architecture/APPLICATION_WORKFLOW_AND_ENGINES_README.md)

## Repository layout

```text
.
|-- README.md                      # Short repo landing (GitHub / quick start)
|-- COMPAT_POINTERS.md             # Legacy filenames → canonical docs (replaces old root stubs)
|-- core/                          # Application layer, contracts, domain engines, harnesses, master-data infra
|-- frontend/                      # Shared DTO mapping + API client (`frontend/api/`)
|-- wp-adapter/                    # REST, WP repositories, logging, mail-ingress, dev/diagnostics
|-- kalkulator/                    # Calculator UI; includes `js/offerProjection/` (canonical offer → UI/PDF/email)
|-- konfigurator/                  # Machine-room configurator UI (`configurator-unified.js`, `buffer-engine.js`, …)
|-- docs/                          # Canonical project documentation (`overview/`, `contracts/`, `runbooks/`, …)
|-- libraries/                     # Legacy browser PDF helpers (html2canvas/jspdf/html2pdf bundles)
|-- scripts/                       # Local WP runtime sync/start, payload helpers
|-- heatpump-calculator.php        # WordPress plugin bootstrap
|-- AGENTS.md                      # Repo-level execution rules for coding agents
|-- preview.php                    # Standalone UI preview (no full WordPress)
```

## Module READMEs (per layer)

Deeper, layer-scoped descriptions live next to the code (single source for each module’s role and boundaries):

- [Core (`core/`)](README_TOP-INSTAL_HVAC_Calculator_Core.md)
- [WP Adapter (`wp-adapter/`)](README_TOP-INSTAL_HVAC_Calculator_WP-Adapter.md)
- [Kalkulator (`kalkulator/`)](README_TOP-INSTAL_HVAC_Calculator_Kalkulator_Layer.md)
- [Konfigurator (`konfigurator/`)](README_TOP-INSTAL_HVAC_Calculator_Konfigurator.md)
- [Frontend API (`frontend/api/`)](README_TOP-INSTAL_HVAC_Calculator_Frontend_API_Layer.md)

## Verification

Use the lightest relevant verification first.

General verification:

```powershell
npm run verify
```

Contract and fixtures:

```powershell
npm run test:contract
npm run test:fixtures
```

REST verification when a local or remote WP runtime is available:

```powershell
$env:TOPINSTAL_REST_BASE_URL = "https://twoja-domena.pl"
$env:TOPINSTAL_REST_NONCE = "twoj_nonce"
npm run test:rest
```

Engine parity and targeted backend harnesses live in:

- `core/application/harness/`

## Documentation map

Start here:

1. [Documentation map (README)](../README.md)
2. [Application workflow and engines](../architecture/APPLICATION_WORKFLOW_AND_ENGINES_README.md)
3. [Handbook](../HANDBOOK.md)
4. Per-layer module READMEs (links in [Module READMEs](#module-readmes-per-layer) above)

Architecture and rules:

- [repo-rules](../architecture/repo-rules.md)
- [boundary-map](../architecture/boundary-map.md)
- [change-surface-checklist](../architecture/change-surface-checklist.md)

Contracts:

- [API_CALCULATE_OFFER](../contracts/API_CALCULATE_OFFER.md)
- [dto-and-boundaries](../contracts/dto-and-boundaries.md)
- [field-mapping](../contracts/field-mapping.md)
- [payload-field-classification](../contracts/payload-field-classification.md)

Operational docs:

- [manual-runtime-setup](../runbooks/manual-runtime-setup.md)
- [PDF_CONVERTER_RUNTIME_VERIFICATION](../runbooks/PDF_CONVERTER_RUNTIME_VERIFICATION.md)
- [REST_AUTH_AND_AGENT_KEY_VERIFICATION](../runbooks/REST_AUTH_AND_AGENT_KEY_VERIFICATION.md)

Ecosystem:

- [TOPINSTAL_ECOSYSTEM_STATE](../ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md)
- [TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL](../ecosystem/TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md)

Archived historical material:

- [archive/README](../archive/README.md)

## Root-level compatibility pointers

Legacy single-filename bookmarks are listed in **[COMPAT_POINTERS.md](../../COMPAT_POINTERS.md)** at the repository root (replaces separate `FIELD_MAPPING.md`, `DISCOVERY_REPORT.md`, etc.).

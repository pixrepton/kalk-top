# OfferDTO → PDF generator mapping audit

> Status: canonical audit (analysis complete; **implementation not started**)
> Owner: TOP-INSTAL / kalk-top + top-instal-generator
> Last verified against code/runtime: 2026-06-04
> Source-of-truth level: L2
> Related: `BACKLOG_RESOLUTIONS_2026-06-04.md` §8 (Problem 7), `memory-bank/open-questions.md`

**Date:** 2026-06-04  
**Producer:** `kalk-top` (`CalculateOfferUseCase`, `downloadPDF.js`)  
**Consumer:** `top-instal-generator` (`OfferDocumentInputMapper`, `PlaceholderBuilderService`)  
**Mode:** `from-offer-dto` (calculator offer download / email attachment)

## OPEN WORK (Problem 7 — save for next session)

**Analysis done in this session; code changes belong primarily in `top-instal-generator`.**

| Priority | Task | Files |
|----------|------|-------|
| **P0** | Map `engineering.ozc.designHeatLoss_kW`, `heatedArea_m2` into offer PDF placeholders | Generator template, `PlaceholderBuilderService.php` |
| **P0** | Map `pricing.items[]` line summary + total | `OfferDocumentInputMapper.php`, template |
| **P1** | Remove hardcoded `floorArea=100`, `heatingType`, `buildingType`, `customPriceFloorGross` from `map_from_offer_dto()` | `OfferDocumentInputMapper.php` L281–284 |
| **P1** | Indoor/outdoor units from `pumpSelection` or snapshot (avoid catalog defaults) | kalk-top `downloadPDF.js` + mapper |
| **P2** | Unify doc: energy PDF (`pdfGenerator.js`) vs offer PDF (generator) | both repos |

**Regression to extend after implementation:** `top-instal-generator/core/application/harness/from-offer-dto-machine-room.regression.php`

**Do not confuse with:** energy report PDF built in kalk-top (`kalkulator/js/pdfGenerator.js`) — that path already renders OZC/costs; commercial offer PDF does not.

## Executive summary

The calculator sends a rich `OfferDTO` plus `context.machineRoomSnapshot`. The generator maps only a **small equipment/pricing slice** into Word placeholders (`MOC`, `KIT`, `INDOOR`, `OUTDOOR`, `CWU`, `TANK`, `BFR`, `PRC`). Most OZC, buffer explainability, pricing line items, and building geometry **never reach the PDF**.

Highest business risk: **`floorArea` / `heatingType` / `buildingType` / `customPriceFloorGross` are hardcoded defaults** in `from-offer-dto` mode (100 m², water, house, 15 000 PLN) — irrelevant for heat-pump offers but lossy if the path is reused.

## Data flow

```
kalk-top UI
  → OfferDTO (REST calculate-offer)
  → downloadPDF.js / emailSender.js
      offerDto + context.machineRoomSnapshot
  → AJAX heatpump_generate_offer_document
  → OfferDocumentsGeneratorClient
  → POST /wp-json/topinstal/v1/offer-documents/generate
  → OfferDocumentInputMapper::map_from_offer_dto()
  → PlaceholderBuilderService::build()
  → DOCX/PDF template
```

## Field matrix

Legend: **mapped** = taken from OfferDTO/context; **default** = constant fallback; **heuristic** = inferred/parsed; **missing** = not used in PDF path.

### Top-level OfferDTO

| OfferDTO field | PDF / placeholder impact | Status | Notes |
|---|---|---|---|
| `schemaVersion` | none | missing | Validation only |
| `traceId` | none | missing | Logging/trace only |
| `warnings[]` | none | missing | |
| `assumptions[]` | none | missing | |
| `engineMeta.*` | none | missing | |

### `engineering.ozc` (full OZC payload)

| Field | PDF impact | Status |
|---|---|---|
| `designHeatLoss_kW` | none | missing |
| `recommendedPower_kW` | none | missing |
| `heatedArea_m2` | none | missing |
| `hotWaterPower_kW` | none | missing |
| `metrics.*` | none | missing |
| `extended.heating_costs[]` | none | missing |
| `extended.heating_costs_assumptions` | none | missing |
| `extended.energy_losses[]` | none | missing |
| `audit.*` | none | missing |
| `assumptions[]`, `warnings[]` | none | missing |

OZC is used in kalk-top's **separate energy-report PDF** (`pdfGenerator.js`), not in `top-instal-generator` offer template.

### `engineering.selection`

| Field | Maps to | Status | Source priority |
|---|---|---|---|
| `pumpModel` | `KIT` placeholder | **mapped** | `machineRoomSnapshot.selected_components.pump.model/name` → `selection.pumpModel` |
| `capacity_kW` | `MOC` placeholder | **mapped** | snapshot `power_kw` → `selection.capacity_kW`; kit catalog regex fallback |
| `type`, `phase` | none | missing | |
| `recommendedModels[]` | none | missing | |
| `notes[]`, `warnings[]`, `reasonCodes[]` | none | missing | |
| `pumpSelection` object | none | missing | |

### `engineering.buffer`

| Field | Maps to | Status | Notes |
|---|---|---|---|
| `liters`, `setupType` | `BFR` via `bufferEnabled` / `bufferCapacity` | **mapped** | Disabled when `setupType=NONE` or liters≤0 |
| `bufferLabel` (derived) | `BFR` text | **mapped** | From `machineRoomSnapshot.selected_components.buffer.label` |
| `severity`, `explanation`, `sizing*` | none | missing | Rich UX in calculator only |

### `engineering.cwu`

| Field | Maps to | Status | Notes |
|---|---|---|---|
| `recommendedCapacityL`, `resolvedOptionId` | indirect | **heuristic** | Via snapshot `cwu.optionId` / label regex |
| `pricingHint` | none | missing | |
| `annualCwuEnergy_kWh` | none | missing | |
| all other CWU fields | none | missing | |

### `pricing`

| Field | Maps to | Status | Notes |
|---|---|---|---|
| `totals.gross` | `PRC` (price) | **mapped** | Overridden by `machineRoomSnapshot.total_brutto_pln` when present |
| `totals.net`, `totals.vat` | none | missing | |
| `items[]` (line-level pricing) | none | missing | Configurator breakdown not in offer PDF |
| `catalogVersion`, `source` | none | missing | |

### `context.machineRoomSnapshot` (not part of OfferDTO schema, sent alongside)

| Field | Maps to | Status | Notes |
|---|---|---|---|
| `total_brutto_pln` | `PRC` | **mapped** | Takes priority over `pricing.totals.gross` |
| `selected_components.pump.*` | `KIT`, `MOC` | **mapped** | Primary source for model/power |
| `selected_components.cwu.*` | `CWU`, `TANK` | **mapped** | Label parsing for capacity/manufacturer |
| `selected_components.buffer.*` | `BFR` | **mapped** | |
| `summary_rows[]` | none | missing | Shown in UI, not PDF |
| `recommendations` | none | missing | |

### Hardcoded in `map_from_offer_dto()` (lines 281–284)

| Generator input | Value | Status | Risk |
|---|---|---|---|
| `floorArea` | 100 | **default** | Wrong if floor-heating template path reused |
| `heatingType` | `water` | **default** | |
| `buildingType` | `house` | **default** | |
| `customPriceFloorGross` | 15000 | **default** | Floor-heating price fallback only |
| `installationType` | `heat_pump` | **default** | OK for current product |
| `tankManufacturer` fallback | `Trinnity` | **default** | When snapshot lacks manufacturer |
| `tankCapacity` fallback | `guess_tank_capacity(kitModel)` | **heuristic** | KIT-ADC/AXC → aio sizes; else `200` |

### PlaceholderBuilder output (heat pump path)

| Placeholder | Source | Status |
|---|---|---|
| `MOC` | `powerKw` | mapped |
| `KIT` | `kitModel` | mapped |
| `INDOOR` | kit catalog `indoor_unit` | **default** `WH-SDC09K3E8` if catalog miss |
| `OUTDOOR` | kit catalog `outdoor_unit` | **default** `WH-UDZ09KE8` if catalog miss |
| `CWU` | tank label / capacity map | mapped/heuristic |
| `TANK` | `tankManufacturer` | mapped/default |
| `BFR` | buffer label or capacity | mapped |
| `PRC` | `customPriceGross` | mapped |

## What works well

- **Configurator pricing parity:** `machineRoomSnapshot.total_brutto_pln` correctly drives `PRC` (regression: `from-offer-dto-machine-room.regression.php`).
- **Equipment labels:** pump/CWU/buffer selections from configurator flow into placeholders when snapshot is present.
- **CWU disable:** `cwu-none` / zero capacity → `Bez c.w.u.` in PDF.

## Gaps (business-facing)

1. **No building context in offer PDF** — heated area, OZC kW, annual costs, location/climate not rendered.
2. **No pricing itemization** — `pricing.items[]` discarded; customer sees single gross only.
3. **Indoor/outdoor unit names** — catalog defaults may not match selected Panasonic kit if catalog lookup fails.
4. **Lossy defaults block** — `floorArea=100` etc. should not run for heat-pump offers (dead fields today, confusing for future template work).
5. **Dual PDF systems** — energy report (kalk-top `pdfGenerator.js`) vs commercial offer (generator); fields diverge intentionally but confuse stakeholders.

## Recommendations (priority)

| P | Action |
|---|---|
| P0 | Map `engineering.ozc.designHeatLoss_kW` + `heatedArea_m2` into new template placeholders (or appendix table). |
| P0 | Map `pricing.items[]` summary (top N lines + total) — configurator already computes them. |
| P1 | Remove hardcoded `floorArea`/`heatingType`/`buildingType` defaults from `from-offer-dto`; use null-safe omission. |
| P1 | Pass `engineering.selection.pumpSelection.indoor/outdoor` into generator to avoid catalog default units. |
| P2 | Unify documentation: which PDF path owns which customer-facing numbers. |

## Code references

- Mapper: `top-instal-generator/core/application/OfferDocumentInputMapper.php` (`map_from_offer_dto`)
- Placeholders: `top-instal-generator/wp-adapter/services/PlaceholderBuilderService.php`
- Offer producer: `kalk-top/core/application/CalculateOfferUseCase.php`
- Calculator PDF bridge: `kalk-top/kalkulator/js/downloadPDF.js` (`buildOfferDocumentContext`)
- Schema: `kalk-top/docs/ecosystem/schemas/offer-dto.v1.json`

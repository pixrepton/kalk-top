# Backlog resolutions — OZC, runtime, PDF mapping (2026-06-04)

> Status: canonical operational record (session closeout)
> Owner: TOP-INSTAL / kalk-top
> Last verified against code/runtime: 2026-06-04
> Source-of-truth level: L2
> Related: `ozc-professional-method-audit.md` § Code sync status, `offer-dto-pdf-mapping-audit.md`, commit `152cca1`

## 1. Purpose

Single reference for the **eight backlog items** reviewed with the business owner in June 2026: what was a real bug, what was intentional design, what was fixed in code, and what remains open (especially **Problem 7 — PDF field mapping**).

Use this doc when onboarding agents or reconciling audit narratives with runtime behavior.

## 2. Authoritative building model (owner)

These semantics override older audit wording that treated `heated_area` as a user input.

| UI field                             | Meaning                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| `floor_area`                         | **Powierzchnia zabudowy (m²)** — brutto footprint **including** external walls               |
| `building_length` × `building_width` | Alternative to `floor_area` when `regular_method=dimensions`                                 |
| `wall_size`                          | Wall thickness (cm); required for traditional/canadian — drives brutto→netto                 |
| `building_heated_floors[]`           | Which floors are heated; **Poddasze** = value `building_floors + 1` (only when roof=`steep`) |
| `building_roof`                      | `flat`, `steep` (z poddaszem), `oblique` (bez poddasza)                                      |

**Pipeline:**

```
floor_area (brutto) → minus wall_size → netto per floor
heated_area = netto × heated floors (+ attic/basement rules)
```

Form UI: `kalkulator/calculator.php`, `kalkulator/js/floorRenderer.js`, `kalkulator/js/rules.js`.

## 3. Summary table (problems 1–8)

| #   | Topic                                                      | Verdict                           | Code/doc action                                             |
| --- | ---------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------- |
| 1   | Skrajne ścieżki OZC (brak wymiarów, fallback netto=brutto) | **Partial risk only**             | Documented §4; no code change — form gates block most paths |
| 2   | `steep` bez Poddasze → fałszywa korekta poddasza           | **Bug — fixed**                   | `resolveAtticHeatingContext()` + regression                 |
| 3   | Zawyżona roczna energia / koszty (HDD)                     | **P1 mitigated**                  | `utilizationFactor=0.72`; SCOP 4 unchanged                  |
| 4   | Luki w zakresach pomp                                      | **Removed from backlog**          | Owner: luki ~0.1 kW — akceptowalne                          |
| 5   | Sync `catalog_items.jsonl` vs `equipment-catalog.json`     | **Removed from backlog**          | Owner: osobne warstwy celowo                                |
| 6   | `ozcResult` REST bypass                                    | **Removed from backlog**          | Owner: zamierzony kontrakt integracji                       |
| 7   | OfferDTO → PDF generator mapping                           | **CLOSED 2026-06-08** (by design) | `offer-dto-pdf-mapping-audit.md` § Operator decision        |
| 8   | Git commit po 1–7                                          | **Done**                          | `152cca1` on `kalk-top` master                              |

## 4. Problem 1 — form vs engine edge paths

### 4.1 What the audit flagged

- `computeGeometry()` assumes ~square when only `floor_area` + `wall_size` (no length/width).
- `convertToCieploAppFormat()` fallback L2051–2053: `netto = brutto` without wall subtract when `geometry` missing.

### 4.2 What the form actually allows

| Path                                             | Reachable from calculator UI? | Notes                                                                                    |
| ------------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------- |
| `regular_method=dimensions`                      | Yes                           | `building_length` + `building_width` required                                            |
| `regular_method=area`                            | Yes                           | `floor_area` required; **no dimensions** — engine uses square heuristic with `wall_size` |
| Missing `wall_size`                              | **No**                        | `wallGateSatisfied()` + `required` on `#wall_size` (`rules.js`)                          |
| `convertToCieploAppFormat` brutto=netto fallback | **No** in normal UI           | `computeDesignHeatLoss()` always sets `geometry.floorArea`                               |
| Bypass without geometry                          | Only integrations             | `ozcResult` in REST (intentional per owner)                                              |

### 4.3 Conclusion

- **Owner was right:** the calculator form is an integral gate; “empty bubbles” do not reach engines in the happy path.
- **Remaining nuance:** `regular_method=area` is a **deliberate** UI path where the engine estimates netto from brutto + `wall_size` via square assumption — not a missing-validation bug.
- **P0-2** (`floor_area` netto semantics in `computeGeometry`) stays **open** as a model-alignment item, not a form-bypass bug.

## 5. Problem 2 — steep attic (fixed)

**Rule:** Attic multipliers apply only when `building_roof === 'steep'` **and** `building_heated_floors` contains `building_floors + 1` (Poddasze checked).

**Bug (before):** `resolveAtticHeatingContext()` returned `applyOnLastHeatedFloor: true` for any `steep` where max heated floor = `building_floors`, without requiring Poddasze.

**Fix:** `core/domain/ozc/OzcEngine.php` — implicit attic branch removed; `oblique` never triggers attic correction.

**Regression:** `core/application/harness/ozc-full-audit.regression.php` — steep without poddasze has no attic assumption; with `[1, building_floors+1]` applies correction.

## 6. Problem 3 — annual energy inflation (P1)

**Owner scope:** reduce systematic inflation of annual kWh/costs; **keep SCOP 4**; **do not** fix CO/CWU cost split (P0-6 out of scope).

**Changes:**

- `resolveHddHeatTransfer()` already applies `(1 - eta_rec)` on ventilation for HDD (partial P0-4).
- `computeAnnualEnergy_kWh()` now multiplies HDD estimate by `DEFAULTS['annualEnergy']['utilizationFactor']` = **0.72** (documented non-certificate gains / non-full-load allowance).

**Still simplified (honest limits):** no balance-temperature model, no per-pump SCOP from catalog, indoor setpoint does not scale annual kWh.

## 7. Problems 4–6 — removed from backlog (owner decisions)

| Item                                                       | Owner rationale                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Pump range gaps                                            | Catalog analysis: ~0.1 kW gaps on surface/mixed; radiators contiguous |
| Panasonic `catalog_items.jsonl` ↔ `equipment-catalog.json` | Extraction layer vs runtime catalog — intentionally separate          |
| `ozcResult` REST bypass                                    | Trusted integration path — keep                                       |

Do not re-open these without explicit owner request.

## 8. Problem 7 — OfferDTO → PDF (audited, **CLOSED 2026-06-08**)

**Status:** Operator decision — **implementation not planned** (by design). See `offer-dto-pdf-mapping-audit.md` §Operator decision.

### 8.1 Canonical audit doc

[`offer-dto-pdf-mapping-audit.md`](offer-dto-pdf-mapping-audit.md) — full field matrix (mapped / default / heuristic / missing).

### 8.2 What works today

- `context.machineRoomSnapshot.total_brutto_pln` → `PRC` (price)
- `selected_components.pump/cwu/buffer` → `KIT`, `MOC`, `CWU`, `BFR`
- Regression: `top-instal-generator/core/application/harness/from-offer-dto-machine-room.regression.php`

### 8.3 Highest gaps (business)

1. No OZC / heated area / annual costs in **offer** PDF (those live in separate energy report: `kalkulator/js/pdfGenerator.js`).
2. `pricing.items[]` not rendered — single gross only.
3. Hardcoded defaults in `map_from_offer_dto()`: `floorArea=100`, `heatingType=water`, `buildingType=house`, `customPriceFloorGross=15000`.
4. Indoor/outdoor unit names fall back to catalog defaults if lookup fails.

### 8.4 Implementation backlog (priority)

| P   | Action                                                                            | Primary files                                                     |
| --- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| P0  | Map `engineering.ozc.designHeatLoss_kW`, `heatedArea_m2` to template placeholders | `top-instal-generator` template + `PlaceholderBuilderService.php` |
| P0  | Map `pricing.items[]` summary into offer PDF                                      | `OfferDocumentInputMapper.php`, template                          |
| P1  | Remove dead hardcoded defaults from `from-offer-dto` heat-pump path               | `OfferDocumentInputMapper.php` L281–284                           |
| P1  | Pass indoor/outdoor from `pumpSelection` / snapshot                               | kalk-top `downloadPDF.js` context + mapper                        |
| P2  | Document which PDF path owns which customer-facing numbers                        | both repos' docs                                                  |

### 8.5 Data flow (reference)

```
kalk-top: CalculateOfferUseCase → OfferDTO
kalk-top: downloadPDF.js → AJAX heatpump_generate_offer_document
  payload: { offerDto, context.machineRoomSnapshot }
kalk-top: wp-adapter/mail-ingress/OfferDocumentsGeneratorClient.php
top-instal-generator: POST /wp-json/topinstal/v1/offer-documents/generate
  mode: from-offer-dto
  → OfferDocumentInputMapper::map_from_offer_dto()
  → PlaceholderBuilderService::build()
```

### 8.6 kalk-top touchpoints

| File                                         | Role                                                    |
| -------------------------------------------- | ------------------------------------------------------- |
| `kalkulator/js/downloadPDF.js`               | `buildOfferDocumentContext`, `cloneMachineRoomSnapshot` |
| `kalkulator/js/emailSender.js`               | Same snapshot for email attachment                      |
| `heatpump-calculator.php`                    | `ajax_generate_offer_document`                          |
| `core/application/CalculateOfferUseCase.php` | OfferDTO producer                                       |
| `docs/ecosystem/schemas/offer-dto.v1.json`   | Schema                                                  |

## 9. Runtime harness fixes (same session, commit `152cca1`)

| Fix             | Change                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Port **8091**   | `scripts/configure-runtime-wp.php`, `scripts/start-runtime-wp.ps1`, Playwright defaults         |
| REST BOM        | `wp-adapter/rest/RestJsonGuard.php`, `CalculateOfferController.php`, `scripts/scan-php-bom.mjs` |
| E2E pricing     | `tests/e2e/configurator-pricing-steps.spec.ts`, `calculator-flow.ts` helpers                    |
| Form navigation | `advanceToNextTab()` → `goToTab()` + JS click fallback                                          |

**Proof:** `KALK_TOP_RUNTIME_PORT=8091 npm run runtime:start` then `npm run proof` (exit 0).

## 10. Open OZC items (after this session)

| ID                    | Status           | Notes                                       |
| --------------------- | ---------------- | ------------------------------------------- |
| P0-1 additive kW      | **Fixed**        | Physics-only design load                    |
| P0-2 floor_area/netto | **Open**         | Model alignment; form uses brutto correctly |
| P0-3 steep attic      | **Fixed**        | Explicit Poddasze only                      |
| P0-4 annual HDD       | **Partial**      | eta_rec + utilization 0.72                  |
| P0-5 static SCOP      | **Open**         | Owner accepts SCOP 4                        |
| P0-6 CO cost split    | **Out of scope** | Owner: ignore when no CWU                   |

## 11. Verification

```powershell
cd kalk-top
npm run test:contract    # OZC attic regression, heating costs, offer smoke
$env:KALK_TOP_RUNTIME_PORT="8091"
npm run runtime:start
npm run proof            # verify + REST + Playwright @critical
```

Calculator URL: `http://127.0.0.1:8091/?page_id=5`

## 12. Related docs

- `ozc-professional-method-audit.md` — P0/P1 narrative + Code sync table
- `offer-dto-pdf-mapping-audit.md` — Problem 7 field matrix
- `docs/dev/KALK_TOP_AGENT_HARNESS.md` — verify commands, port 8091
- `docs/runbooks/PROOF_BEFORE_DEPLOY.md` — proof gate
- `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md` — cross-repo generator integration
- `memory-bank/open-questions.md` — Problem 7 pointer

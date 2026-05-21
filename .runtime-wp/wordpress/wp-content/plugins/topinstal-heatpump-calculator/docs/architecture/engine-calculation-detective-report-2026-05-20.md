# Engine Calculation Detective Report

> Status: audit / defect register
> Owner: TOP-INSTAL engineering
> Date: 2026-05-20
> Method: GitNexus MCP (`context`, `cypher`, `impact`) + source read + PHP regression harnesses
> Related: `docs/architecture/ozc-professional-method-audit.md`, `docs/architecture/engine-graphs/`

## Goal

Find defects that prevent **correct, trustworthy calculation outputs** across `ozc`, `selection`, `cwu`, `buffer`, `pricing` and the `CalculateOfferUseCase` spine.

## GitNexus index (post `--force`)

| Metric        | Value                                                                               |
| ------------- | ----------------------------------------------------------------------------------- |
| Repo          | `kalk-top`                                                                          |
| Indexed at    | 2026-05-20T10:18:29Z                                                                |
| Nodes / edges | 8615 / 15106                                                                        |
| Orchestration | `execute` → `resolve_ozc_result` → selection/CWU/buffer → `computeBuffer` → `price` |

## Harness verdict (2026-05-20)

| Harness                                 | Result                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `ozc-full-audit.regression.php`         | PASS                                                                                            |
| `ozc-heating-costs.regression.php`      | PASS                                                                                            |
| `cwu-engine.regression.php`             | PASS                                                                                            |
| `selection-aio-cwu.regression.php`      | PASS                                                                                            |
| `buffer-explainability.regression.php`  | PASS                                                                                            |
| `foundation-pricing.regression.php`     | PASS                                                                                            |
| `engine-parity.php` (PHP↔JS full stack) | **FAIL** — `clonePumpTableFallback is not defined` in `konfigurator/configurator-unified.js:37` |

Regressions prove **internal consistency** of current PHP (and partial JS) behavior; they do **not** prove physical/methodological correctness where the model is wrong by design.

---

## P0 — Must fix for trustworthy numbers

### P0-OZC-1: Additive kW corrections double-count physics

**Evidence (GitNexus):** `calculateOZC` → `computeAdditiveCorrectionsKw` (L680–732); JS parity symbol `Function:kalkulator/engine/ozc/ozc-engine.js:computeAdditiveCorrectionsKw`.

**Mechanism:**

```text
phiT, phiV (with eta_rec), phiPsi already include U*A, ventilation, bridges
designHeatLoss_W = phiT + phiV + phiPsi + additiveKw * 1000
```

Additive table again adjusts windows, doors, `mechanical_recovery`, basement — phenomena already in `HT_windows_doors`, `phiV`, floor boundary.

**Symptom:** Drift vs physical-only baseline from about **−1.20 to +1.57 kW** on representative variants (2026-05-06 parity sample).

**Fix:** Canonical `designHeatLoss_kW` = physics only; move additive block to `advisoryEmpiricalAdjustment_kW` (off by default) + regression matrix.

---

### P0-OZC-2: Annual energy ignores recovery in HDD path

**Evidence:** Design: `phiV = HV * dT * (1 - eta_rec)` (L838). Annual: `resolveHddHeatTransfer` returns `H_transmission * 1.1 + H_ventilation` where `H_ventilation = 0.34 * V_dot` **without** `(1 - eta_rec)` (L1146–1161, L1963).

**Symptom:** Rekuperacja obniża obciążenie projektowe, ale roczna energia i koszt pompy ciepła pozostają jak przy wentylacji bez odzysku → **zawyżone koszty** przy `mechanical_recovery`.

**Fix:** `H_ventilation_annual = H_ventilation * (1 - eta_rec)` (or separate annual ventilation model); label annual output as estimate.

---

### P0-OZC-3: Sloped roof ⇒ forced “attic” geometry

**Evidence:** `computeGeometry` / `convertToCieploAppFormat` — last heated floor + `oblique`/`steep` roof ⇒ volume ×0.65, heated area ×0.8, total area +44%.

**Symptom:** Typowy dom jednopoziomowy ze skosem: `heated_area` ~99 m² z wejścia 135 m², `annual_energy_factor` ~204 kWh/m² (audit sample).

**Fix:** Explicit `top_floor_type`; never infer attic from roof shape alone.

---

### P0-OZC-4: `heated_area` / `floor_area` shrunk by wall thickness

**Evidence:** `computeGeometry` treats `floor_area` as gross footprint and subtracts wall structure from dimensions.

**Symptom:** Netto mniejsze niż metraż ogrzewany podany przez użytkownika → zaniżony wolumen, zniekształcony wskaźnik roczny, błędne pola w raporcie.

**Fix:** Separate `heated_area_m2` (net, no subtraction) vs `gross_footprint_m2`.

---

### P0-OZC-5: Heat-pump cost model (SCOP, tariff, CWU/CO split)

**Evidence:** Default SCOP 4.0, tariff 1.1 PLN/kWh; catalog COP/SCOP not wired; `annual_cost_co_pln` only when `annual_cwu_kwh > 0` (P0-6 in method audit).

**Fix:** `scopCoUsed` / `copCwuUsed` from selected model; always emit CO split when `annualCoKWh > 0`.

---

## P1 — Propagation / secondary engines

### P1-SEL-1: Selection is exact-match-only; no nearest pump fallback

**Status:** Intentional (`use_nearest_fallback = false`). **Risk:** empty or weak match when OZC demand sits between catalog bands → operator must intervene; not a math bug but a coverage gap.

**Dependency:** Any P0-OZC `designHeatLoss_kW` error moves pump tier immediately.

---

### P1-BUF-1: Buffer liters scale with OZC-inflated power

**Status:** `computeBuffer` logic consistent with rules; explainability regressions PASS.

**Risk:** Cascaded oversizing when upstream kW is high (anti-cycling, hydraulic deficit).

---

### P1-CWU-1: CWU engine — no P0 defect in isolation

**Status:** `cwu-engine.regression.php` PASS; GitNexus shows clean separation from `designHeatLoss_kW`.

**Watch:** AIO integrated tank path must stay aligned with `SelectionEngine.resolve_aio_requirement` (regression covered).

---

### P1-PRC-1: Pricing falls back to `ozc.designHeatLoss_kW`

**Evidence:** `PricingEngine.php` uses `designHeatLoss_kW` when pump power missing.

**Risk:** Wrong catalog line or price tier if OZC wrong even when selection object is incomplete.

---

## P2 — Tooling / parity gaps (block “bezbledne” end-to-end proof)

### P2-HARNESS-1: `engine-parity.php` broken on configurator bootstrap

**Error:** `ReferenceError: clonePumpTableFallback is not defined` at `konfigurator/configurator-unified.js:37`.

**Impact:** Cannot run full PHP↔JS offer-path parity in CI until fixed.

---

### P2-GITNEXUS-1: Semantic `query` still reports missing FTS

After user `--force`, `context`/`cypher` work; `query` may still warn. Use `context`/`cypher` for agent workflows until FTS confirmed.

---

## Recommended fix order (bezbledne obliczenia)

1. **OZC canonical load** — remove additive from `designHeatLoss_kW` (P0-OZC-1).
2. **OZC geometry contract** — heated vs gross footprint, attic flag (P0-OZC-2, P0-OZC-3).
3. **OZC annual path** — apply `eta_rec` in `H_total_for_HDD` (P0-OZC-2).
4. **OZC costs** — SCOP/CWU/CO split (P0-OZC-5).
5. **Re-run** `ozc-full-audit`, new additive/geometry/regression matrix; then `engine-parity` after configurator fix.
6. **Selection/catalog** — only after OZC stable; verify edge demands at band boundaries.

## What is already OK (2026-05-20)

- CWU PHP logic and PHP↔JS CWU parity harness.
- Buffer explainability and sizing formulas vs rules snapshot.
- Foundation pricing option-id mapping.
- Selection AIO/CWU gating (250–350 L large AIO only with catalog pair).
- Offer orchestration wiring (GitNexus CALLS on `execute`).

## Next agent session

- Implement P0-OZC-1 + P0-OZC-2 with targeted regressions.
- Fix `clonePumpTableFallback` for parity harness.
- Add `engine-graphs` cross-link from this report in `README.md` (done in engine-graphs README).

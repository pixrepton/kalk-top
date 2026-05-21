# OZC Output Requirements (contract)

Source of truth for this document:

- `core/domain/ozc/OzcEngine.php` (`TopInstal_OzcEngine_Full`)
- `core/application/CalculateOfferUseCase.php`

---

## 1. Output shapes in system

There are two relevant output layers:

1. PHP engine output (`computeDesignHeatLoss`) - backend domain shape (physics-only `designHeatLoss_kW`)
2. OfferDTO output (`engineering.ozc`) - REST contract used by frontend

---

## 2. Legacy cieplo-format fields (PHP `calculateOZCWithExtended`)

PHP full engine produces cieplo-compatible formatted output with (among others):

- `max_heating_power`
- `recommended_power_kw`
- `heated_area`
- `design_outdoor_temperature`
- `annual_energy_consumption`
- `annual_energy_consumption_factor`
- `avg_heating_power`
- `avg_outdoor_temperature`
- `heating_power_factor`
- `hot_water_power`
- `source`
- `extended`:
  - `energy_losses`
  - `improvements`
  - `heating_costs`
  - `bivalent_points`

- `recommended_power_kw == max_heating_power` (heating only, no DHW add-on)

---

## 3. PHP OZC engine output contract

### 3.1 Fields always expected by application layer

Both `TopInstal_OzcEngine` (including compatibility class name `TopInstal_OzcEngine_Mvp`) and `TopInstal_OzcEngine_Full` return at least:

- `designHeatLoss_kW` (float)
- `recommendedPower_kW` (float)
- `heatedArea_m2` (float)
- `assumptions` (array)
- `warnings` (array)
- `reasonCodes` (array)

### 3.2 Extra fields from `TopInstal_OzcEngine_Full`

When native full runtime succeeds, additional fields are returned:

- `source` (string, expected `internal_ozc_engine`)
- `audit` (object):
  - `defaults_used`
  - `methods`
  - `sanity`
  - `energy_losses_percent_sum`
- `raw` (object, internal/debug raw OZC physics result)
- `metrics` (object):
  - `annual_energy_consumption`
  - `annual_energy_consumption_factor`
  - `avg_heating_power`
  - `avg_outdoor_temperature`
  - `design_outdoor_temperature`
  - `heating_power_factor`
- `extended` (object):
  - `energy_losses`
  - `improvements`
  - `heating_costs`
  - `heating_costs_assumptions`
  - `bivalent_points`

### 3.3 Fallback semantics in full engine

If native full runtime fails:

- engine falls back to parity PHP result when available, otherwise MVP
- `warnings` gets item with code `OZC_FULL_ENGINE_FAILED`
- `reasonCodes` includes `OZC_FULL_ENGINE_FAILED`
- `assumptions` gets `OZC_FULL_ENGINE_FALLBACK`

---

## 4. OfferDTO mapping (`CalculateOfferUseCase`)

`OfferDTO.engineering.ozc` contains:

- `designHeatLoss_kW`
- `recommendedPower_kW`
- `hotWaterPower_kW`
- `heatedArea_m2`
- `source`
- `assumptions`
- `warnings`
- `audit` (object or `null`)
- `metrics` (object or `null`)
- `extended` (object or `null`)
  - `extended.heating_costs_assumptions` is additive parity metadata for cost-calculation assumptions

Important:

- `hotWaterPower_kW` in OfferDTO is now aligned by `CalculateOfferUseCase` with canonical backend `TopInstal_CwuEngine` when available.
- OZC still carries the field and remains the thermal-load owner, but CWU demand semantics are centralized in the CWU engine.
- legacy use-case fallback formula is only used when CWU engine output is unavailable.

`OfferDTO.engineMeta.ozcVersion`:

- `php-mvp-1` for MVP
- `php-full-1` for Full class

---

## 5. Stability and compatibility notes

1. Backward-compatible core fields are preserved:
   - `designHeatLoss_kW`, `recommendedPower_kW`, `heatedArea_m2`
2. Full-only enrichment is additive (`source`, `audit`, `metrics`, `extended`; `raw` stays engine-internal).
3. Rollback is configuration-only via `USE_FULL_OZC_ENGINE=false` (falls back to MVP PHP class, not browser JS).
4. `designHeatLoss_kW` is physics-only (no additive kW Strategy A').
5. `engineering.ozc.extended.heating_costs_assumptions` documents cost-model defaults (SCOP, tariffs).

---

## 6. Verification checklist

Minimal checks for full-contract correctness:

1. `engineMeta.ozcVersion == php-full-1`
2. `engineering.ozc.source == internal_ozc_engine`
3. `engineering.ozc.designHeatLoss_kW > 0`
4. `engineering.ozc.extended` exists and is object/array
5. no `OZC_FULL_ENGINE_FAILED` in full-success scenario

Recommended harnesses:

- `php core/application/harness/ozc-full-audit.regression.php`
- `php core/application/harness/calculate-offer.fixtures.php`
- `php core/application/harness/rest-calculate-offer.e2e.php`
- `php core/application/harness/ozc-heating-costs.regression.php`

# OZC Input Requirements (contract)

Payload field classification (ZAWSZE / LUB / OPCJONALNIE): `docs/contracts/payload-field-classification.md`

Source of truth for this document:

- `core/domain/ozc/OzcEngine.php`
- `wp-adapter/rest/RequestValidator.php`
- `core/application/CalculateOfferUseCase.php`

---

## 1. Scope

This file describes required and optional inputs for OZC in backend calculation (`POST /wp-json/topinstal/v1/calculate-offer`).

There are two OZC execution modes exposed by classes defined in `OzcEngine.php`:

1. `TopInstal_OzcEngine` / `TopInstal_OzcEngine_Mvp` (legacy simplified PHP engine)
2. `TopInstal_OzcEngine_Full` (canonical native PHP full runtime)

Engine selection is controlled by feature flag:

- default -> `TopInstal_OzcEngine_Full`
- `USE_FULL_OZC_ENGINE=false` -> `TopInstal_OzcEngine`

---

## 2. CalcRequestDTO minimum (REST validator)

These are required by `RequestValidator` before OZC is called:

- `schemaVersion` (string, must be `1.0`)
- `lead` (object)
- `building` (object)
- `preferences` (object)
- `preferences.heating` (object)
- `preferences.dhw` (object)
- positive geometry in one of these shapes:
  - `building.heated_area` OR
  - `building.floor_area` OR
  - `building.total_area`
  - OR both `building.building_length` and `building.building_width`

Conditional validator rules:

- if `preferences.dhw.enabled == true`, then `preferences.dhw.persons > 0` is required

---

## 3. Inputs used by OZC Full (canonical runtime path)

`TopInstal_OzcEngine_Full` normalizes `building` plus selected fallbacks from `preferences` and computes the result natively in PHP.

### 3.1 Effective required geometry

For full parity with JS OZC runtime, payload should provide:

- `floor_area`
  OR
- both `building_length` and `building_width`

Note:

- Full engine tries to fill `floor_area` from `heated_area`/`total_area` if missing.
- If full runtime fails, engine falls back to parity and returns warning `OZC_FULL_ENGINE_FAILED`.

### 3.2 Recommended core fields (for 1:1 parity)

Geometry and building envelope:

- `floor_area`, `building_length`, `building_width`, `floor_perimeter`
- `building_floors`, `building_heated_floors`, `floor_height`
- `building_roof`, `building_shape`, `wall_size`

Climate and temperatures:

- `location_id`
- `indoor_temperature`
- optionally `design_outdoor_temperature`

Construction and materials:

- `construction_type`
- `primary_wall_material`
- `external_wall_isolation` (`material`, `size`)
- `internal_wall_isolation` (`material`, `size`) for canadian structure
- `top_isolation`, `bottom_isolation`

Openings:

- `windows_type`, `number_windows`, `number_huge_windows`
- `doors_type`, `number_doors`, `number_balcony_doors`

Boundary conditions:

- `building_type` (`single_house`, `apartment`, `row_house`)
- apartment: `whats_over`, `whats_under`, `whats_north`, `whats_south`, `whats_east`, `whats_west`
- row house: `row_position`, `row_shared_walls_count`, `on_corner`
- optional: `unheated_space_over_type`, `unheated_space_under_type`, `has_basement`

Ventilation and heating context:

- `ventilation_type`
- `heating_type`
- `source_type`

DHW context:

- `include_hot_water`
- `hot_water_persons`
- `hot_water_usage`

---

## 4. Preference -> payload fallback mapping in `OzcEngineFull`

When fields are absent in `building`, full engine maps from `preferences`:

- `preferences.heating.emitterType` -> `building.heating_type`
- `preferences.heating.ventilationType` -> `building.ventilation_type`
- `preferences.heating.indoorTemperatureC` -> `building.indoor_temperature`
- `preferences.dhw.enabled` -> `building.include_hot_water`
- `preferences.dhw.persons` -> `building.hot_water_persons`
- `preferences.dhw.usageProfile` -> `building.hot_water_usage`

Default location fallback:

- if `building.location_id` is empty, set to `PL_STREFA_III`

---

## 5. Manual parity engine behavior (compatibility)

`TopInstal_OzcEngine` (and compatibility class name `TopInstal_OzcEngine_Mvp`) is tolerant and computes output with fallbacks.

Important MVP fallback examples:

- missing area -> fallback area model (warning `OZC_INCOMPLETE_INPUT`)
- missing/unknown data -> heuristic multipliers by year/ventilation/heating/climate

Manual parity mode does not require Node runtime.

---

## 6. Runtime requirements for OZC Full

Required for `TopInstal_OzcEngine_Full`:

- PHP runtime with `core/domain/ozc/OzcEngine.php`
- no Node dependency in active `calculate-offer` runtime

If native full runtime fails:

- OZC Full returns parity PHP fallback result when available, otherwise MVP
- warning code: `OZC_FULL_ENGINE_FAILED`
- assumption code: `OZC_FULL_ENGINE_FALLBACK`

---

## 7. Practical readiness checklist

For reliable native OZC runtime:

1. Send full geometry + materials + boundary-condition fields in `building`.
2. Keep `preferences.heating` and `preferences.dhw` populated (for fallback mapping consistency).
3. Enable `USE_FULL_OZC_ENGINE` in environment.
   If rollback is needed, explicitly set `USE_FULL_OZC_ENGINE=false`.
4. Verify canonical runtime with harness:
   - `php core/application/harness/ozc-full-audit.regression.php`
   - `php core/application/harness/calculate-offer.fixtures.php`
   - `php core/application/harness/rest-calculate-offer.e2e.php`
5. OZC open-risk register (design load vs annual cost): `docs/architecture/ozc-professional-method-audit.md` § Code sync status (2026-06-04).

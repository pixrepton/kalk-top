# OZC Professional Method Audit

> Status: comprehensive audit after GitNexus indexing (findings below); code sync table kept current
> Owner: TOP-INSTAL engineering / OZC
> Last verified against code/runtime: 2026-06-04 (post-commit `152cca1`: poddasze fix, annual utilization 0.72)
> Source-of-truth level: L2
> Related graphs: `docs/architecture/engine-graphs/ozc.graph.md`, GitNexus repo `kalk-top`
> Runtime: PHP canonical backend only (`TopInstal_OzcEngine_Full`); browser `ozc-engine.js` and JS parity harness removed

## Code sync status (2026-06-04)

This section tracks **open vs fixed** findings against `core/domain/ozc/OzcEngine.php`. Historical P0 sections below still describe the 2026-05-20 audit narrative; use this table for current priority.

| ID | Finding (summary) | Code status | Affects pump sizing? |
|----|-------------------|-------------|----------------------|
| P0-1 | Additive kW corrections double-count physics | **Fixed** — `designHeatLoss_kW` is physics-only; `computeAdditiveCorrectionsKw()` removed | Was yes; no longer |
| P0-2 | `floor_area` / `heated_area` shrunk by wall thickness | **Open** — `computeGeometry()` still subtracts `wall_size` from footprint | Yes |
| P0-3 | Sloped roof treated as heated attic | **Fixed** — attic multipliers only when `building_roof === 'steep'` **and** `building_heated_floors` contains `building_floors + 1` (Poddasze checkbox) | Yes (steep + poddasze only) |
| P0-4 | Annual HDD model / recovery in annual energy | **Partial** — `resolveHddHeatTransfer()` applies `(1 - eta_rec)`; `computeAnnualEnergy_kWh()` applies `utilizationFactor=0.72` (non-certificate gains allowance) | No (annual only) |
| P0-5 | Static SCOP / default tariff vs selected pump | **Open** — hardcoded SCOP/tariff path; `panasonic.json` SCOP not wired into cost breakdown | No (cost display) |
| P0-6 | `annual_cost_co_pln` hidden when CWU = 0 | **Open** — CO split null unless `annual_cwu_kwh > 0` | No (cost display) |

**Verification:** `npm run test:contract` (includes `ozc-full-audit.regression.php`, `ozc-heating-costs.regression.php`), `npm run verify`, `npm run proof` (runtime port **8091**).

**Session resolutions (owner-aligned):** [`BACKLOG_RESOLUTIONS_2026-06-04.md`](BACKLOG_RESOLUTIONS_2026-06-04.md) — form gates vs engine edge paths, removed backlog items 4–6, Problem 7 PDF audit pointer.

### Form ↔ engine gates (Problem 1, 2026-06-04)

The calculator form is an integral part of the pipeline; most audit “edge paths” are **not reachable** from the UI:

| Engine path | UI reachable? |
|-------------|---------------|
| Missing `wall_size` | No — `rules.js` `wallGateSatisfied()` + required slider |
| `convertToCieploAppFormat` netto=brutto without wall subtract | No in normal flow — `geometry.floorArea` always set by `computeGeometry()` |
| `floor_area` only (no length/width) | Yes — `regular_method=area`; engine uses square heuristic + `wall_size` (intended) |
| No geometry at all | Only `ozcResult` REST bypass (owner: keep) |

Authoritative field semantics: `floor_area` = brutto footprint; heated area derived from `building_heated_floors[]` — see `BACKLOG_RESOLUTIONS_2026-06-04.md` §2.

## Executive Summary

The OZC engine is not failing because of one global coefficient. The current behavior points to a mixed problem:

1. Some paths are physically reasonable and produce realistic results.
2. Some paths double-count or double-credit features that are already represented in the physical model.
3. Annual energy and heat-pump costs are much less professional than design-load calculation and can be heavily overstated.
4. Output formatting can show wrong areas and misleading indicators, so a numerically acceptable load can still look wrong in the result section.

The highest-risk **remaining** issues (see code sync table above) before treating OZC as high-confidence:

- Fix geometry semantics for `floor_area`, `heated_area`, wall thickness, and `steep`-roof attic handling.
- Replace the annual heat-pump cost model with a separate, explicitly non-certificate model that uses recovery efficiency, selected pump SCOP/COP, tariff assumptions, and indoor setpoint effects.
- Fix result-section cost breakdown and area metrics.

## GitNexus Status

GitNexus MCP was installed with `npx gitnexus setup` and the repository was indexed as `kalk-top`:

```text
8,615 nodes | 15,106 edges | 332 clusters | 300 flows
repo path: C:\Users\compg\Desktop\kalk-top
indexed/refreshed: 2026-05-20 (analyze --name kalk-top --skip-git --force)
```

Cross-engine detective register: `docs/architecture/engine-calculation-detective-report-2026-05-20.md`

Useful graph observations from GitNexus:

- `CalculateOfferUseCase.execute` is the runtime spine: OZC -> selection -> CWU -> buffer -> pricing.
- `calculateHeatingCostsDetailed` is called by `calculateOZCWithExtended` and impacts OZC output/harnesses.
- `computeAnnualEnergy_kWh` feeds formatted annual energy and extended heating costs.
- `computeAdditiveCorrectionsKw` feeds canonical `designHeatLoss_kW` through `calculateOZC`.

Note: GitNexus full-text query reported a read-only DB warning during `query`, but `context`, `impact`, `list`, and repository indexing worked.

## Professional Baseline

This audit compares implementation behavior to the public scope of currently relevant Polish/European sources:

- PN-EN 12831-1:2017-08: design heat load for rooms, building entities and buildings under design internal/external conditions.
- PN-EN 12831:2006: withdrawn and replaced by PN-EN 12831-1:2017-08.
- PN-EN ISO 6946:2017-10: thermal resistance and U-value calculation for ordinary building components, excluding windows, doors, glazing and ground-contact components.
- PN-EN ISO 13370:2017-09: heat transfer through the ground, including slab-on-ground floors, raised floors and basements.
- PN-EN ISO 52016-1:2017-09: procedures for heating/cooling energy needs, indoor temperatures, and sensible/latent heat loads using monthly or hourly methods.
- Polish regulation Dz.U. 2015 poz. 376: binding methodology regulation for building energy performance certificates; it defines, among other things, regulated-temperature area as heated/cooled net floor area.

Public links checked on 2026-05-06:

- https://sklep.pkn.pl/pn-en-12831-1-2017-08e.html
- https://sklep.pkn.pl/pn-en-12831-2006p.html
- https://sklep.pkn.pl/pn-en-iso-6946-2017-10p.html
- https://sklep.pkn.pl/normy/pn-en-iso-13370-2017-09p.html
- https://sklep.pkn.pl/normy/pn-en-iso-52016-1-2017-09e.html
- https://eli.gov.pl/eli/DU/2015/376/ogl

## Current Calculation Graph

Canonical design load in PHP/JS:

```text
HT_wall/window/door/roof/floor = U * A
phiT = sum(HT_i * boundary_deltaT_i)
phiV = 0.34 * V_dot_m3h * design_deltaT * (1 - eta_rec)
phiPsi = phiT * 0.10
designHeatLoss_W = phiT + phiV + phiPsi + additiveCorrections_kW * 1000
```

Annual energy and heat-pump cost:

```text
H_total_for_HDD = selected transmission H * 1.10 + unrecovered ventilation H
annualEnergy_kWh = H_total_for_HDD * HDD * 24 / 1000
heatPumpCost = (annualCoKWh + annualCwuKWh) / SCOP * electricityPLNperKWh
```

Output formatting:

```text
heated_area = net floor area with automatic attic reduction on last heated floor under sloped roof
total_area = gross floors + 44% extra attic area for sloped roof
annual_energy_consumption_factor = annualEnergy / heated_area
avg_daily_energy_consumption = annualEnergy / 365
avg_heating_power = designPower * averageSeasonDeltaT / designDeltaT
```

## P0 Findings

### P0-1: Additive Corrections Double-Count Physical Inputs

Location:

- `core/domain/ozc/OzcEngine.php`: `computeAdditiveCorrectionsKw()`, `calculateOZC()`
- `kalkulator/engine/ozc/ozc-engine.js`: same parity path

Current behavior:

- Windows are represented by `U_window * A_window`, then old/new window types add/subtract kW again.
- Doors are represented by `U_door * A_door`, then door type adds kW again.
- Mechanical heat recovery reduces design ventilation through `(1 - eta_rec)`, then subtracts another `0.7 kW`.
- Basement can subtract up to `0.3 kW` without changing floor boundary physics.

Why this violates clean design-load logic:

- In a PN-EN 12831-style model, transmission and ventilation effects should enter once through U-values, areas, airflows, recovery efficiency, and boundary temperatures.
- Extra kW corrections are only acceptable if they represent a distinct named allowance. Here they modify the same phenomena again.

Observed symptom:

- Neutral cases look plausible.
- Old-window/old-door cases overshoot.
- Recovery/basement cases can undershoot.

Recommendation:

- Make canonical `designHeatLoss_kW` physical-only by default.
- Keep additive deltas only as `advisoryEmpiricalAdjustment_kW` or a disabled policy seam.
- Add regression tests for baseline, old windows, old doors, recovery, basement, and combined variants.

### P0-2: `floor_area` / `heated_area` Can Be Reinterpreted as Gross Footprint and Shrunk

Location:

- `computeDesignHeatLoss()` maps missing `floor_area` from `heated_area` or `total_area`.
- `computeGeometry()` then treats `floor_area` as gross and subtracts wall thickness.

Current behavior:

- If user sends `heated_area=135` and no explicit dimensions, backend sets `floor_area=135`.
- Geometry assumes a square gross footprint and subtracts external wall thickness from both dimensions.
- With `wall_size=24 cm`, 135 m2 becomes about 124 m2 net before further calculations.

Why this is a bug:

- Polish methodology uses heated/cooled net floor area for regulated-temperature area.
- User-facing `heated_area` normally already means usable/heated area, not gross external footprint.
- Shrinking it again underestimates volume, wall area, annual factor denominator behavior, and downstream sizing assumptions.

Recommendation:

- Introduce explicit fields: `heated_area_m2`, `gross_footprint_area_m2`, `conditioned_volume_m3`, `external_perimeter_m`.
- Do not subtract walls from `heated_area`.
- Only subtract wall thickness when the source field is explicitly external/gross footprint or length/width by external outline.

### P0-3: Any Sloped Roof on the Last Heated Floor Is Treated as an Attic

Location:

- `computeGeometry()` sets `isLastFloorAttic` when the last heated floor equals total floors and roof is `oblique` or `steep`.
- `convertToCieploAppFormat()` applies the same attic assumption to output area.

Current behavior:

- A normal one-storey house with a sloped roof is treated as if the only heated floor were an attic.
- Volume gets multiplied by `0.65`.
- Heated area gets multiplied by `0.8`.
- Total area gets an extra `44%` attic addition.

Observed JS parity sample for a 135 m2 one-storey house with sloped roof:

```text
heated_area: 99 m2
total_area: 194 m2
annual_energy_factor: 204 kWh/m2
```

Why this is a bug:

- Roof shape does not imply that the heated storey is an attic.
- A one-storey bungalow with a pitched roof and normal ceiling should not lose 35% volume and 20% heated area.
- This distorts result-section trust even when design load happens to remain near a plausible value.

Recommendation:

- Add explicit `top_floor_type`: `normal_ceiling`, `heated_attic`, `unheated_attic`, `sloped_heated_space`.
- Apply volume/area reduction only for explicit heated attic/sloped heated space.
- Never add `0.44 * floor_area` to `total_area` unless an attic floor exists as a separate, user-declared area.

### P0-4: Annual Heat Demand Model Is Not Auditor-Grade and Overstates Heat-Pump Cost

Location:

- `computeAnnualEnergy_kWh()`
- `resolveHddHeatTransfer()`
- `calculateHeatingCostsDetailed()`

Current behavior:

- Annual energy = `H_total_for_HDD * HDD * 24 / 1000`.
- It uses a full-season transfer coefficient with no internal gains, solar gains, utilization factors, balance temperature treatment, intermittency, or heating-season schedule.
- Indoor setpoint does not affect annual energy. Tests explicitly accept this behavior.
- Mechanical recovery is applied to design `phiV`, but annual `H_total_for_HDD` uses unrecovered ventilation `H_ventilation`.

Why this explains inflated pump costs:

- Heat-pump cost is mostly formulaically correct once annual energy is supplied.
- The annual energy supplied to it is too high for many real buildings because it is gross heat loss over HDD rather than annual useful heat need after gains and operating schedules.
- For recovery ventilation, the mismatch is even clearer: design sees recovery, annual energy largely does not.

Recommendation:

- Split `designHeatLoss_kW` from `annualUsefulHeat_kWh` with different method labels.
- For a near-term realistic estimator, apply at least: recovery efficiency in annual ventilation, gain allowance/utilization, balance-temperature or setpoint-adjusted HDD, heating-season factor, and emitter/pump temperature class.
- For a professional-grade path, implement or integrate monthly/hourly PN-EN ISO 52016-style energy need logic and Polish methodology reporting.

### P0-5: Heat-Pump Cost Uses Static SCOP and Default Tariff Instead of Selected Equipment

Location:

- PHP `calculateHeatingCostsDetailed()` accepts `scopUsed`, but defaults to `4.0`.
- JS `calculateOZCDetailed()` calls `calculateHeatingCosts({ annualCoKWh, annualCwuKWh })` and does not pass payload fuel prices or SCOP.
- `konfigurator/panasonic.json` contains COP/SCOP/COPdhw data but the cost path does not use it.

Current behavior:

- Default electricity price is `1.1 PLN/kWh`.
- Default heat-pump SCOP is `4.0`.
- CWU energy, if present, is also divided by the same SCOP, even though catalog has `COPdhw` values and real DHW COP is often different from CO seasonal SCOP.

Why this is wrong:

- The selected pump model and emitter temperature should affect seasonal electricity consumption.
- CO and CWU should use separate efficiency assumptions.
- Static tariff and SCOP make the displayed annual cost sensitive to defaults rather than the actual selected system.

Recommendation:

- Use selected model SCOP by climate/emitter class where available.
- Use separate `scopCoUsed` and `copCwuUsed`.
- Pass user/current tariff assumptions through JS and PHP consistently.
- Mark tariffs as assumptions with date/source; do not hardcode them silently.

### P0-6: Cost Breakdown Hides CO Cost When CWU Is Zero

Location:

- `annual_cost_co_pln` is set only when `annual_cwu_kwh > 0`.

Current behavior:

- With no CWU, total cost is present, but CO split is `null`.
- UI then may omit breakdown columns or make the result look incomplete.

Recommendation:

- Always set `annual_cost_co_pln` when `annualCoKWh > 0`.
- Set `annual_cost_cwu_pln` to `0` or `null` based on display policy, but do not hide CO.

## P1 Findings

### P1-1: `wall_size` Semantics Are Ambiguous and Can Bias U-Wall

Location:

- `computeWallStructureThicknessCm()` subtracts external/internal insulation from `wall_size`.

Risk:

- If UI/user means “mur 24 cm + ocieplenie 15 cm”, current code treats 24 cm as total assembly, subtracts 15 cm, then clamps structure to 18 cm.
- If UI/user means total wall thickness, current behavior is more defensible.

Recommendation:

- Define contract explicitly.
- Preferred: `wall_size` = structural wall thickness, insulation sizes separate.
- Add migration if legacy data used total assembly thickness.

### P1-2: Wall/Roof/Floor U-Values Are Incomplete for Many Assemblies

Risk points:

- If insulation exists but wall material is missing, wall U may be based on insulation alone.
- Roof/floor U uses insulation layer plus surface resistances, not full roof/strop/slab/ground assembly.
- Ground-contact elements should not be handled only by ISO 6946-style layer U.

Recommendation:

- Require primary layer or use a conservative assembly fallback.
- Separate roof slope, ceiling below attic, slab-on-ground, floor over unheated basement, floor over outdoor air.
- Add assumptions visible in results when assembly data are incomplete.

### P1-3: Ground Loss Model Is a Lite Heuristic, Not PN-EN ISO 13370

Current behavior:

- `theta_ground = theta_m_e + 1`, clamped.
- Optional `ground_iso13370_lite` changes ground temp by only +/- 1 C based on B'.
- Floor loss uses U _ area _ ground deltaT \* shape correction.

Recommendation:

- Rename to `ground_lite_v1` in audit output.
- Implement a real ISO 13370-lite module using B', perimeter, edge insulation, basement/floor type and annual/seasonal components.
- Treat missing perimeter as high-risk warning, not a quiet approximation.

### P1-4: Thermal Bridges Are a Uniform 10% Multiplier

Current behavior:

- `phiPsi = phiT * 0.10`.

Risk:

- Professional calculations use linear thermal transmittance `Psi * length`, not one uniform percent on all transmission.
- A uniform 10% can be acceptable as a conservative estimator, but it is not detailed-auditor-grade.

Recommendation:

- Keep as a named heuristic only for calculator mode.
- Add optional bridge detail input: wall/floor junctions, roof/wall, window installation perimeter, balcony/slab details.

### P1-5: Ventilation Uses ACH Defaults Instead of Room/Use Airflows

Current behavior:

- Natural/gravity/mechanical/recovery ventilation is converted into ACH defaults.

Risk:

- Professional load/energy calculations use explicit airflows, infiltration assumptions, airtightness or system design data.
- ACH defaults can overstate annual cost in tight buildings or understate in leaky buildings.

Recommendation:

- Let payload provide design ventilation airflow and infiltration class.
- For recovery, store supply/extract flow balance and recovery efficiency separately for design and annual energy.

### P1-6: Climate Defaults Are Too Broad for High Confidence

Current behavior:

- Missing location defaults to `PL_STREFA_III` / `PL_III`.

Risk:

- Design temperature differences between Polish climate zones can materially change design load.
- For borderline selection ranges, a broad default can choose a different pump.

Recommendation:

- Make location/climate zone required for high-confidence output.
- Expand location-to-zone mapping and expose default-zone warnings prominently.

## P2 / Output and Product Findings

### P2-1: Result Area Metrics Can Be Wrong

Fields impacted:

- `total_area`
- `heated_area`
- `annual_energy_consumption_factor`
- `heatedArea_m2` in offer engineering output

Cause:

- The sloped-roof attic inference and gross/net area conversion described in P0.

Recommendation:

- Show original user area, modeled heated area, modeled envelope area and conditioned volume separately.
- Do not mix “net heated area” with “external footprint area”.

### P2-2: `avg_daily_energy_consumption` Is Misleading

Current behavior:

- `annualEnergy / 365` is displayed/available as a daily metric.

Risk:

- Heating energy is seasonal; daily average across all year can be misread as typical winter day consumption.

Recommendation:

- Remove from primary results or relabel as `annual_average_daily_heat_kWh` with explanation.
- Prefer heating-season average or design-day estimate if needed.

### P2-3: `avg_heating_power` Is Not an Annual Average Heating Power

Current behavior:

- It is computed as design power scaled by average seasonal outdoor temperature.

Risk:

- The label suggests measured/annual average power, but it is only a simplified point estimate at seasonal mean outdoor temperature.

Recommendation:

- Rename to `heating_power_at_avg_season_temp_kW` or hide from consumer result view.

### P2-4: Bivalent Point Output Is Advisory, Not Pump-Curve-Based

Current behavior:

- Uses fixed `T_biv = -6 C` and scales power linearly.

Risk:

- Real bivalent point depends on selected pump capacity curve, flow temperature and climate.

Recommendation:

- After selection, compute bivalence from selected pump performance data where available.
- Before selection, label it as generic reference only.

### P2-5: Results Renderer Converts Heat Demand to Electric kWh with Fixed COP=4

Location:

- `kalkulator/js/resultsRenderer.js`

Current behavior:

- `annual_energy_consumption` is thermal heat demand.
- UI computes displayed electricity kWh as thermal/4.

Risk:

- This creates a second fixed-COP path outside OZC heating costs.
- It can disagree with selected pump, tariff assumptions and cost table.

Recommendation:

- Centralize CO electricity consumption in one engine field.
- Use selected pump SCOP and separate CWU COP.

## Downstream Engine Impact

### Selection

- Consumes `designHeatLoss_kW` from OZC.
- It does not appear to add CWU into design load directly.
- If OZC is overstated by old-window additive deltas, selection can jump to a larger pump.
- If OZC is understated by recovery/basement double-crediting or attic-volume bug, selection can undersize.

Recommendation:

- After P0 fixes, run range-boundary fixtures around catalog thresholds.
- Log `designHeatLossPhysical_kW`, `selectedCapacity_kW`, and threshold decision.

### Buffer

- Consumes OZC design load, selected pump, emitter type, heated area and hydraulic assumptions.
- Buffer sizing can drift if selected pump changes due OZC or if heated area is wrong.

Recommendation:

- Re-test anti-cycling and system-volume cases after geometry fixes.
- Use corrected `heated_area_m2`, not gross or attic-reduced accidental area.

### CWU

- Separate from design heating load in the offer flow.
- Annual CWU energy is added to heating cost comparison.

Recommendation:

- Use separate DHW COP for heat pump annual costs.
- Keep CWU design power separate from CO design heat loss.

### Pricing

- Offer pricing is based mainly on selected components, not annual energy cost.
- Annual heating costs live in OZC extended output/results/PDF, not the offer pricebook calculation.

Recommendation:

- Do not fix annual heating costs in `PricingEngine`; fix them in OZC/results cost engine.
- Ensure selected pump metadata can flow into annual-cost calculation.

## Recommended Fix Plan

### Phase 1: Stop Wrong Numbers

1. Remove additive corrections from canonical `designHeatLoss_kW`.
2. Fix annual recovery in `H_total_for_HDD`.
3. Pass payload fuel prices and `scopUsed` through JS `calculateHeatingCosts`.
4. Fix `annual_cost_co_pln` when CWU is zero.
5. Disable automatic one-storey sloped-roof attic reduction unless explicit attic flag exists.

### Phase 2: Fix Semantics

1. Split area fields into net heated, gross footprint, envelope floor, total building area.
2. Clarify `wall_size` as structural or total assembly and migrate inputs.
3. Replace `avg_heating_power` and `avg_daily_energy_consumption` labels.
4. Add explicit method confidence flags: `design_load_method`, `annual_energy_method`, `ground_method`, `cost_method`.

### Phase 3: Make It Professional-Grade

1. Implement monthly/seasonal annual energy model aligned with PN-EN ISO 52016-style structure and Polish methodology assumptions.
2. Implement ISO 13370-lite ground transfer with perimeter/B' and floor/basement types.
3. Add selected-pump SCOP/COP integration from catalog.
4. Add climate/location dictionary and force warning for defaults.
5. Add calibration fixtures against auditor/professional benchmark cases.

## Test Matrix Required Before Release

Minimum regression matrix:

- One-storey flat roof, 100/135/180 m2.
- One-storey sloped roof with normal ceiling.
- Heated attic explicitly declared.
- Two-storey with unheated attic above.
- Old/new/triple windows with identical area.
- Old/new doors with identical area.
- Natural/gravity/mechanical/recovery ventilation.
- Basement unheated/heated/no basement.
- Apartment with heated and unheated neighbors.
- PL_I through PL_V climate zones.
- Underfloor/radiator/mixed emitters and selected pump SCOP classes.
- CWU disabled/enabled for 1/2/4/6 persons.

Acceptance rules:

- Design load changes from windows only through U-window and area.
- Design load changes from recovery only through ventilation recovery efficiency.
- Sloped roof does not reduce heated area/volume unless attic is explicit.
- Annual heat-pump cost uses selected CO SCOP and CWU COP.
- No-CWU results still show CO annual cost.
- The UI labels thermal kWh, electric kWh, cost assumptions, and non-certificate limitations separately.

## Evidence Samples

JS parity sample run on 2026-05-06 for a 135 m2 one-storey house:

```text
oblique roof base:
  max_heating_power=8.20 kW
  annual_energy=20,293 kWh thermal
  heat_pump_cost=5,581 PLN/year
  heated_area=99 m2
  total_area=194 m2
  factor=204 kWh/m2

flat roof same inputs:
  max_heating_power=9.18 kW
  annual_energy=22,357 kWh thermal
  heat_pump_cost=6,148 PLN/year
  heated_area=124 m2
  total_area=135 m2

old windows:
  max_heating_power=10.15 kW
  annual_energy=22,072 kWh thermal
  heat_pump_cost=6,070 PLN/year

recovery ventilation:
  max_heating_power=5.43 kW
  annual_energy=19,061 kWh thermal
  heat_pump_cost=5,242 PLN/year

indoor 19 C vs 23 C:
  design power changes
  annual energy stays identical at 20,293 kWh
```

Interpretation:

- The heat-pump cost complaint is valid.
- The biggest cost inflation source is annual thermal demand, not only the final PLN formula.
- Area/result formatting errors are severe enough to make trust collapse even when some loads look plausible.
- The “50% realistic / 50% off” pattern is consistent with conditional feature triggers and geometry interpretation, not one bad global multiplier.

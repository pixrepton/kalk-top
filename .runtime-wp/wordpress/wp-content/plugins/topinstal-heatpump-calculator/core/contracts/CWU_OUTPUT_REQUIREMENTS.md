# CWU Output Requirements (contract)

Source of truth for this document:
- `core/domain/cwu/CwuEngine.php`
- `konfigurator/configurator-unified.js`
- `core/application/CalculateOfferUseCase.php`

---

## 1. Input ownership

`TopInstal_CwuEngine` does not introduce a new public REST request shape.

It consumes existing `CalcRequestDTO` fields:
- `preferences.dhw.enabled`
- `preferences.dhw.persons`
- `preferences.dhw.usageProfile`
- optional `dhwOptionId`
- selected pump context from backend selection

---

## 2. Output in application layer

`TopInstal_CwuEngine::compute(...)` returns a backend domain object with:
- `demandEnabled`
- `enabled`
- `required`
- `skip`
- `skipReason`
- `persons`
- `personsRaw`
- `personsForCapacity`
- `usageProfile`
- `isAio`
- `recommendedCapacityL`
- `hotWaterPower_kW`
- `annualCwuEnergy_kWh`
- `resolvedOptionId`
- `resolvedCapacityL`
- `resolvedMaterial`
- `pricingHint`
- `reasonCodes`
- `warnings`
- `assumptions`
- `explanation`
- `fallback`

Notes:
- `demandEnabled` means DHW demand exists for the building.
- `enabled` / `required` mean an external CWU tank step is applicable.
- AIO can therefore produce:
  - `demandEnabled = true`
  - `enabled = false`
  - `skip = true`

---

## 3. OfferDTO mapping

`CalculateOfferUseCase` exposes additive `OfferDTO.engineering.cwu` with:
- `demandEnabled`
- `enabled`
- `required`
- `skip`
- `skipReason`
- `persons`
- `personsRaw`
- `personsForCapacity`
- `usageProfile`
- `isAio`
- `recommendedCapacityL`
- `hotWaterPower_kW`
- `annualCwuEnergy_kWh`
- `resolvedOptionId`
- `resolvedCapacityL`
- `resolvedMaterial`
- `pricingHint`
- `reasonCodes`
- `warnings`
- `assumptions`
- `explanation`

Compatibility:
- existing clients can ignore `engineering.cwu`
- `engineering.ozc.hotWaterPower_kW` remains present for backward compatibility

---

## 4. Pricing interaction

`PricingEngine` keeps `dhwOptionId` as the highest-priority user choice.

When `dhwOptionId` is missing, pricing can use `engineering.cwu.pricingHint` to price CWU consistently with backend recommendation semantics.

---

## 5. Verification

Recommended checks:
- `php core/application/harness/cwu-engine.regression.php`
- `npm run test:contract`
- `npm run test:fixtures`

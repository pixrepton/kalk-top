# CWU Engine Graph

> Status: operational audit graph
> Owner: `core/domain/cwu/CwuEngine.php`
> Last verified against code/runtime: 2026-05-20 (GitNexus MCP)
> Source-of-truth level: L2
> GitNexus: `Class:core/domain/cwu/CwuEngine.php:TopInstal_CwuEngine` · entry `compute` (L17 area)

## Knowledge Graph

```mermaid
flowchart TD
  CWU[CWU] --> DemandEnabled[DHW enabled]
  CWU --> Persons[persons]
  CWU --> Usage[usage profile]
  CWU --> AIO[AIO integrated tank check]
  CWU --> Capacity[tank capacity recommendation]
  CWU --> Power[hotWaterPower_kW]
  CWU --> Annual[annualCwuEnergy_kWh]
  Capacity --> PriceHint[capacity/material pricing hint]
```

## Dependency Graph

```mermaid
flowchart LR
  Building[building hot_water_*] --> CwuEngine
  Preferences[preferences.dhw/options] --> CwuEngine
  Selection[selection pump type/AIO tank] --> CwuEngine
  Rules[buffer rules: cwuRules + hotWaterPowerPolicy] --> CwuEngine
  PriceBook[price book pricing policy] --> CwuEngine
  CwuEngine --> OZC[OZC hotWaterPower_kW override in use case]
  CwuEngine --> Pricing[Pricing Engine]
  CwuEngine --> Offer[OfferDTO engineering.cwu]
```

## Calculation Graph

```mermaid
flowchart TD
  Start[input] --> Enabled[resolve_demand_enabled]
  Start --> Persons[resolve_persons_raw]
  Start --> Usage[resolve_usage_profile]
  Start --> IsAio[is_aio_selection]
  Enabled --> Required{enabled and persons > 0 and not AIO?}
  Persons --> Required
  IsAio --> Required
  Required -->|yes| BaseCap[base capacity by persons]
  Usage --> Extra[usage adjustment]
  BaseCap --> Cap[recommended capacity]
  Extra --> Cap
  Cap --> Available[round to available capacity]
  Required --> Power[estimate hot water power]
  Required --> Annual[estimate annual DHW energy]
  Cap --> Output[CWU result]
  Power --> Output
  Annual --> Output
```

## Current Notes

- CWU design power is kept separate from OZC design heat loss; `CalculateOfferUseCase` writes CWU power into `engineering.ozc.hotWaterPower_kW` after CWU computation.
- No direct double-count into `designHeatLoss_kW` was found in the offer path.
- GitNexus callers: `CalculateOfferUseCase.resolve_cwu_result`, `TopInstal_OzcEngine.resolve_cwu_engine`, `cwu-engine.regression.php`, `cwu-pricing-catalog.regression.php`.
- Regression harness: PHP/JS CWU parity PASS (2026-05-20).

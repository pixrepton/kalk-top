# Selection Engine Graph

> Status: operational audit graph
> Owner: `core/domain/selection/SelectionEngine.php`
> Last verified against code/runtime: 2026-05-20 (GitNexus MCP)
> Source-of-truth level: L2
> GitNexus: `Class:core/domain/selection/SelectionEngine.php:TopInstal_SelectionEngine` · entry `select` (L17)

## Knowledge Graph

```mermaid
flowchart TD
  Selection[Selection] --> Demand[design heat loss kW]
  Selection --> HeatingType[emitter / heating type]
  Selection --> CWURequirement[AIO CWU requirement]
  Selection --> Preference[pump variant preference]
  Selection --> Catalog[pump matching table]
  Catalog --> ExactRange[exact min/max range match]
  ExactRange --> CandidateSet[candidates]
  CandidateSet --> Chosen[selected model]
  Selection --> SpecialLow[very-low-power special case]
  Selection --> HighPower[high-power catalog limit]
```

## Dependency Graph

```mermaid
flowchart LR
  OZC[OZC designHeatLoss_kW] --> SelectionEngine
  Building[building.heating_type / area / construction] --> SelectionEngine
  Preferences[preferences.heating/options] --> SelectionEngine
  BufferRules[selection rules repository] --> SelectionEngine
  CWUCtx[selection CWU context] --> SelectionEngine
  SelectionEngine --> CWU[CWU Engine]
  SelectionEngine --> Buffer[Buffer Engine]
  SelectionEngine --> Pricing[Pricing Engine]
  SelectionEngine --> Offer[OfferDTO engineering.selection]
```

## Calculation Graph

```mermaid
flowchart TD
  Start[demand_kw] --> Normalize[normalize heating type]
  Normalize --> Ranges[scan pumpMatchingTable ranges]
  Ranges --> Matches[exact range matches]
  Matches --> CWUFilter[filter for AIO CWU requirement]
  CWUFilter --> Sort[sort by power/model]
  Sort --> Specials{special case?}
  Specials -->|low power skeleton| Force3kW[force low-power split]
  Specials -->|high power range| Force16kW[force catalog-limit model]
  Specials -->|none| Preferred[choose preferred type/phase]
  Force3kW --> Output[pumpSelection hp/aio]
  Force16kW --> Output
  Preferred --> Output
```

## Current Notes

- The engine intentionally uses exact range matching only; nearest fallback is dormant policy.
- It depends directly on OZC realism: if `designHeatLoss_kW` drifts, pump selection drifts immediately.
- GitNexus callers: `selection-aio-cwu.regression.php`, `engine-parity.php` (parity harness currently fails on missing `clonePumpTableFallback` in configurator JS — see detective report).
- AIO/CWU coupling: `resolve_aio_requirement` → `filter_matches_for_cwu_requirement` → `select`; large tank (≥400 L) blocks AIO; 250–350 L AIO only when catalog maps `aio_model_large_cwu`.

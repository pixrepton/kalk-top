# Pricing Engine Graph

> Status: operational audit graph
> Owner: `core/domain/pricing/PricingEngine.php`
> Last verified against code/runtime: 2026-05-20 (GitNexus MCP)
> Source-of-truth level: L2
> GitNexus: `Class:core/domain/pricing/PricingEngine.php:TopInstal_PricingEngine` · entry `price` (L72 area)

## Knowledge Graph

```mermaid
flowchart TD
  Pricing[Pricing] --> Pump[PUMP item]
  Pricing --> Hydraulic[HYDRAULIC item]
  Pricing --> Buffer[BUFFER item]
  Pricing --> CWU[CWU item]
  Pricing --> Accessories[accessory items]
  Pricing --> Installation[INSTALLATION item]
  Pricing --> Totals[net/vat/gross totals]
  Pricing --> Fallbacks[pricebook fallback warnings]
```

## Dependency Graph

```mermaid
flowchart LR
  PriceBook[equipment catalog / price book] --> PricingEngine
  Selection[pump selection] --> PricingEngine
  BufferResult[buffer recommendation] --> PricingEngine
  CWUResult[CWU recommendation/pricingHint] --> PricingEngine
  Preferences[options ids] --> PricingEngine
  Building[dhw fallback persons] --> PricingEngine
  OZC[recommendedPower/designHeatLoss fallback] --> PricingEngine
  PricingEngine --> Offer[OfferDTO pricing]
```

## Calculation Graph

```mermaid
flowchart TD
  Start[input + pricebook] --> Mode[resolve pricing mode]
  Mode --> PumpSel[resolve effective pump selection]
  PumpSel --> PumpPrice[resolve pump price]
  PumpPrice --> Items[items]
  PumpSel --> Hydraulic[hydraulic components by type]
  Hydraulic --> Items
  Start --> BufferOpt[buffer option selected?]
  BufferOpt --> BufferPrice[resolve buffer price]
  BufferPrice --> Items
  Start --> DHW[DHW enabled and not AIO?]
  DHW --> CwuPrice[resolve CWU price]
  CwuPrice --> Items
  Start --> Accessory[append selected accessories]
  Accessory --> Items
  Items --> Totals[sum net/gross/VAT]
```

## Current Notes

- Pricing is backend-owned and should use `OfferDTO.pricing` as commercial truth.
- It can fall back to OZC `designHeatLoss_kW` when selected pump power is unavailable — ties commercial line items to OZC defects.
- GitNexus: `CalculateOfferUseCase.execute` → `price` (CALLS). Regression: `foundation-pricing.regression.php` PASS.
- Upstream OZC cost semantics (SCOP/tariff/CWU split) affect customer-facing totals indirectly via engineering snapshot, not item catalog keys.

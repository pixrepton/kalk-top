# Konfigurator Instructions

## Scope

This directory owns machine-room configuration choices, option mapping, and rendering of configurator-specific outputs.

## Pricing authority (who calculates what - no ambiguity)

| Layer                                                                   | Role                                                                                                    | Source of numbers                                                                                                                                                                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend offer**                                                       | **Only authority for money that binds the product** (`OfferDTO`, line items, totals, pricing metadata). | `POST .../calculate-offer` -> `CalculateOfferUseCase` -> `PricingEngine` + price book built from `core/infrastructure/master-data/equipment-catalog.json` (`PriceBookRepositoryWp`, etc.).                  |
| **Configurator JS runtime**                                             | Collects selections, shows waiting states, renders backend results.                                     | Reads canonical `OfferDTO` from app/runtime state. Must not invent retail totals, ranges, or PDF/document breakdowns.                                                                                       |
| **Configurator JS parity helpers**                                      | Developer-only comparison helpers for catalog parity and harnesses.                                     | `equipment-catalog.json` mapped to a local price book for tests/harnesses only. Never a production-visible source of truth.                                                                                 |
| **Hydraulics recommendation** (buffer litres, parallel vs return, etc.) | Engineering suggestion, separate from invoice pricing.                                                  | Backend: `BufferEngine` + `engineering-policy.json` via `calculate-offer` (`engineering.buffer`). UI reads `OfferDTO` and `HEATPUMP_CONFIG.bufferRules` snapshot only; do not confuse with `PricingEngine`. |

**Runtime rule:** visible money in configurator, step 10, PDF payloads, and offer payloads must come only from backend `OfferDTO`.

**Developer rule:** helper functions in `configurator-unified.js` such as `calculatePumpPrice`, `calculateBufferPrice`, `calculateCwuPrice`, and `calculateAccessoryPrice` may remain only for parity harnesses. They are not a product fallback.

**If backend pricing is unavailable:**

1. do not show a locally reconstructed total
2. do not generate a document from local pricing
3. show a clear waiting / unavailable state until a fresh `OfferDTO` exists

**Pricing:** canonical offer prices live only in `core/infrastructure/master-data/equipment-catalog.json` (see `PricingEngine` / `PriceBookRepositoryWp`). Do not add monetary amounts to `configurator-presentation.json`, `kalkulator/`, or `frontend/`.

**Presentation:** `configurator-presentation.json` holds card copy, image filenames, and buffer/CWU text - no duplicate of `panasonic.json` and no price fields. Runtime loads it via `loadPresentationData()` in `configurator-unified.js` with inline fallback if fetch fails.

**Technical pump specs:** only `konfigurator/panasonic.json` (`loadPanasonicDB`).

## Always true here

- Configuration choices must not override backend engineering authority without explicit contract logic
- Keep option IDs and selected variants traceable into DTO preferences
- Avoid duplicating offer logic here

## Preferred workflow

- Trace option mapping through `docs/contracts/field-mapping.md`
- Check backend authority whenever configurator output appears inconsistent with offer data
- Use Browser for visible configurator regressions

## Verify after changes here

- `npm run verify:js`
- targeted UI/runtime verification in the browser when rendering changes are visible

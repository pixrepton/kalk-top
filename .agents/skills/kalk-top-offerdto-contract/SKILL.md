---
name: kalk-top-offerdto-contract
description: Use when modifying kalk-top, heat pump calculator logic, OfferDTO, offer payloads, pricing, backend pricebook, configurator frontend summaries, generator integration, PDF/DOCX rendering, or offer document boundaries.
---

# kalk-top OfferDTO Contract

## Use When

- Work touches `kalk-top`, heat pump calculator logic, pricing, `OfferDTO`, generator payloads, or offer rendering contracts.

## Do Not Use When

- The task is Gmail/Daszek runtime without offer calculation or `OfferDTO` boundaries.

## Rules

- `kalk-top` owns HVAC calculation, pricing, and `OfferDTO`.
- Canonical boundary: `POST /wp-json/topinstal/v1/calculate-offer`.
- **top-instal-generator** renders documents; it does not decide offer semantics.
- Configurator visible pricing is backend `OfferDTO` only.
- Preserve contract compatibility across integrations (`docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`).

## Checklist

1. Identify owner repo/component.
2. Identify DTO fields and compatibility constraints.
3. Run `npm run test:contract` and/or `npm run test:fixtures` for boundary changes.
4. State impact on generator and mail-ingress if contracts change.

## Report

- Owner.
- Contract changed.
- Compatibility risk.
- Tests.

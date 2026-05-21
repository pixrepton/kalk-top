# Core Application Instructions

## Scope

This directory owns orchestration from validated request input to assembled offer output.

## Always true here

- Coordinate use cases, validation, ports, and assembly
- Do not render UI
- Do not own WP runtime or transport concerns
- Keep `CalcRequestDTO -> OfferDTO` canonical

## Preferred changes

- Make orchestration explicit
- Keep dependencies flowing inward toward domain
- Use harnesses and fixtures when changing offer behavior

## Verify after changes here

- `npm run test:contract`
- `npm run test:fixtures`
- `npm run test:rest` when the REST boundary is affected

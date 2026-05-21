# Core Domain Instructions

## Scope

This directory owns pure engineering logic.

## Always true here

- No WordPress APIs
- No DOM, browser, or fetch logic
- No mail, PDF, or persistence concerns
- No UI strings as business output
- Keep inputs and outputs DTO-shaped and deterministic

## Preferred changes

- Small, local, testable engine changes
- Preserve reasoning through structured fields such as reason codes and assumptions
- Keep formulas and engineering policy explicit

## Escalate before changing

- DTO shape
- engine output contract
- anything that would push runtime or UI concerns into domain

## Payload input contract

- Building payload fields follow `docs/contracts/payload-field-classification.md`: ZAWSZE / LUB / OPCJONALNIE
- Engines (OZC, MVP) must handle LUB rules (geometry, construction_type, CWU) and optional fields correctly; fallbacks when optional fields are absent

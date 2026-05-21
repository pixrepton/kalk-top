# Kalkulator Instructions

## Scope

This directory owns calculator UI flow, field gating, request preparation, and result rendering behavior.

## Always true here

- Treat backend calculation as canonical
- Do not silently reintroduce frontend-only engineering truth
- Prefer visible, testable flow logic over hidden state magic
- Be explicit about field enablement, visibility, and reset behavior

## Preferred workflow

- For flow bugs, use the calculator form-flow tracer skill
- For hard-to-localize runtime issues, use Browser or Debug Mode rather than patching by guesswork
- Read `docs/contracts/field-mapping.md`, `docs/contracts/payload-field-classification.md`, and `docs/discovery/repo-discovery.md` before deep changes

## Verify after changes here

- `npm run verify:js`
- targeted regression tests in `kalkulator/js/*.test.js` when relevant
- Browser verification for visible UX changes

# AGENTS.md - kalk-top

Status: active repo router.

## Role

`kalk-top` owns HVAC calculation, pricing/data rules and `OfferDTO`.

Do not move HVAC logic or `OfferDTO` ownership into `gmail-agent`, Daszek, RAG or generator repos.

## Read First

1. root `../AGENTS.md`
2. `README.md`
3. `docs/README.md`
4. `docs/architecture/APPLICATION_WORKFLOW_AND_ENGINES_README.md`
5. relevant contract/schema/runbook
6. source and targeted tests

## Protected Contracts

- `docs/contracts/API_CALCULATE_OFFER.md`
- `docs/contracts/dto-and-boundaries.md`
- `docs/contracts/field-mapping.md`
- `docs/contracts/payload-field-classification.md`
- `docs/contracts/README_NOWE_WEJSCIA_CALCULATE_OFFER.md`
- `docs/ecosystem/schemas/*.json`

## Work Rules

- Keep changes local and targeted.
- Verify with repo harness/tests appropriate to the changed layer.
- Do not use repo-local memory-bank or historical backlog docs as active truth.

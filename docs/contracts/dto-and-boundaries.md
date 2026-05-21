# DTO And Boundaries

> Status: canonical
> Owner: TOP-INSTAL contract owner
> Last verified against code/runtime: 2026-04-02 (contract audit)
> Source-of-truth level: L1
> Supersedes: none
> Related docs: `API_CALCULATE_OFFER.md`, `README_NOWE_WEJSCIA_CALCULATE_OFFER.md`, `../SOURCE_OF_TRUTH_INDEX.md`

## Canonical API boundary

- Route: `POST /wp-json/topinstal/v1/calculate-offer`
- Input contract: `CalcRequestDTO`
- Output contract: `OfferDTO`

## `CalcRequestDTO` minimum

- `schemaVersion`
- `traceId`
- `lead`
- `building`
- `preferences`
- `context`

## `OfferDTO` minimum

- `schemaVersion`
- `traceId`
- `engineering`
- `pricing`
- `warnings`
- `assumptions`
- `engineMeta`

## Boundary rules

- Backend calculation is canonical
- Domain code must not generate UI strings
- DTO changes require explicit downstream impact check
- Trace and auth semantics are part of the contract surface

## Downstream consumers

- `top-instal-generator` consumes offer data for document rendering
- `topinstal-mail-ingress` dispatches normalized work into this repo (or via `topinstal-cieplo-orchestrator`, depending on configured backend URL)
- `rag-chat-asystent` may interpret or explain results but does not own calculation

## When to escalate

Escalate and assess ecosystem impact when changing:

- `CalcRequestDTO`
- `OfferDTO`
- REST request or response shape
- auth headers or agent-key semantics
- trace semantics
- generator integration behavior
- mail-ingress workflow boundaries

## Related docs

- Local mapping: `docs/contracts/field-mapping.md`
- Ecosystem state: `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`
- Ecosystem update protocol: `docs/ecosystem/TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md`

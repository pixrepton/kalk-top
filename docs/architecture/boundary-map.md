# Boundary Map

## Canonical repo boundary

- `POST /wp-json/topinstal/v1/calculate-offer`
- Input: `CalcRequestDTO`
- Output: `OfferDTO`

## Internal ownership

### `core/domain`

- engineering logic only
- no WP, UI, persistence, PDF, or mail

### `core/application`

- orchestrates request to offer flow
- validation, assembly, and port coordination

### `wp-adapter`

- REST, runtime auth, logging, repositories, mail-ingress bridge, generator integration

### `kalkulator` and `konfigurator`

- UI state, selection flows, rendering, browser behavior
- not the canonical engineering source of truth

## Cross-repo boundaries

### `topinstal-mail-ingress`

- ingress adapter only
- may dispatch into this repo
- must not own calculation

### `topinstal-cieplo-orchestrator`

- optional VPS orchestration after ingress (builds `CalcRequestDTO`, calls this repo, then generator)
- does not own DTO definitions or calculation rules

### `top-instal-generator`

- document renderer only
- consumes output from this repo
- must not own offer logic

### `rag-chat-asystent`

- knowledge and explainability only
- may interpret results, not calculate them

### `agent-zordon` (separate repo)

- LLM tool-calling orchestration against this repo / generator / RAG; not part of the `kalk-top` tree

## Escalation triggers

- DTO changes
- REST shape changes
- auth or trace semantic changes
- generator integration changes
- mail-ingress workflow changes

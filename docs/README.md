# Documentation map

> Status: canonical
> Owner: TOP-INSTAL documentation governance
> Last verified against code/runtime: 2026-06-04 (OZC backlog resolutions, PDF mapping audit, runtime 8091)
> Source-of-truth level: L1
> Supersedes: none
> Related docs: `docs/SOURCE_OF_TRUTH_INDEX.md`, `docs/DOC_GOVERNANCE.md`, `docs/READ_PRIORITY_MATRIX.md`

Canonical documentation for `kalk-top` lives under **`docs/`** (this folder). The **repository root** keeps a short [`README.md`](../README.md), [`AGENTS.md`](../AGENTS.md), and [`COMPAT_POINTERS.md`](../COMPAT_POINTERS.md) (legacy filenames → canonical paths).

## Start here

1. [../README.md](../README.md) — short landing (links here and to the overview)
2. [SOURCE_OF_TRUTH_INDEX.md](SOURCE_OF_TRUTH_INDEX.md) — strict authority index
3. [READ_PRIORITY_MATRIX.md](READ_PRIORITY_MATRIX.md) — what the agent should read by task type
4. [HANDBOOK.md](HANDBOOK.md) — operator / contributor quick path (layer map)
5. [architecture/APPLICATION_WORKFLOW_AND_ENGINES_README.md](architecture/APPLICATION_WORKFLOW_AND_ENGINES_README.md) — end-to-end workflow

### Governance and operating model

| Document                                                   | Role                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| [SOURCE_OF_TRUTH_INDEX.md](SOURCE_OF_TRUTH_INDEX.md)       | Strict authority index for what is canonical and what is not   |
| [DOC_GOVERNANCE.md](DOC_GOVERNANCE.md)                     | Documentation classes, metadata standard, and anti-drift rules |
| [AGENT_EXECUTION_STANDARD.md](AGENT_EXECUTION_STANDARD.md) | How Cursor agents should operate in this repo                  |
| [READ_PRIORITY_MATRIX.md](READ_PRIORITY_MATRIX.md)         | Read-first matrix by task type                                 |
| Gaps / conflicts                                           | `SOURCE_OF_TRUTH_INDEX.md` §3; history: offloaded archive      |

### AI OS and company model

| Document                                                                   | Role                                 |
| -------------------------------------------------------------------------- | ------------------------------------ |
| Future AI OS blueprint                                                     | offloaded archive / `knowledge/rfc/` |
| [TOPINSTAL_CANONICAL_ENTITY_MODEL.md](TOPINSTAL_CANONICAL_ENTITY_MODEL.md) | Cross-system entity vocabulary       |
| [TOPINSTAL_EVENT_MODEL.md](TOPINSTAL_EVENT_MODEL.md)                       | Cross-system event vocabulary        |

### Layers

See [HANDBOOK.md](HANDBOOK.md) § Layer map. Long per-layer overviews: offloaded `gmail-agent-offloaded-archive/kalk-top-docs-2026-05-30/docs/overview/`.

### Konfigurator — inventory (prices / images)

- [README_DANE_CENY_ZDJECIA_KONFIGURATORA_KALK_TOP.md](konfigurator/README_DANE_CENY_ZDJECIA_KONFIGURATORA_KALK_TOP.md)

## By topic

### Architecture

| Document                                                                                                           | Role                            |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| [architecture/repo-rules.md](architecture/repo-rules.md)                                                           | Layer rules, bans, verification |
| [architecture/boundary-map.md](architecture/boundary-map.md)                                                       | Boundaries between layers       |
| [architecture/change-surface-checklist.md](architecture/change-surface-checklist.md)                               | Change review                   |
| [architecture/decision-criteria.md](architecture/decision-criteria.md)                                             | Decision criteria               |
| [architecture/APPLICATION_WORKFLOW_AND_ENGINES_README.md](architecture/APPLICATION_WORKFLOW_AND_ENGINES_README.md) | Use case and engines            |
| [architecture/BACKLOG_RESOLUTIONS_2026-06-04.md](architecture/BACKLOG_RESOLUTIONS_2026-06-04.md)                   | OZC/PDF backlog 1–8 closeout    |
| [architecture/ozc-professional-method-audit.md](architecture/ozc-professional-method-audit.md)                   | OZC P0/P1 audit + code sync     |
| [architecture/offer-dto-pdf-mapping-audit.md](architecture/offer-dto-pdf-mapping-audit.md)                           | OfferDTO→PDF audit (**P7 open**) |
| [architecture/adr-template.md](architecture/adr-template.md)                                                       | ADR template                    |

### Contracts (API + DTOs)

| Document                                                                                         | Role                                  |
| ------------------------------------------------------------------------------------------------ | ------------------------------------- |
| [contracts/API_CALCULATE_OFFER.md](contracts/API_CALCULATE_OFFER.md)                             | REST contract for `calculate-offer`   |
| [contracts/dto-and-boundaries.md](contracts/dto-and-boundaries.md)                               | DTO boundaries                        |
| [contracts/field-mapping.md](contracts/field-mapping.md)                                         | Field mapping                         |
| [contracts/payload-field-classification.md](contracts/payload-field-classification.md)           | Payload shape                         |
| [contracts/agent-calculate-offer-instruction.md](contracts/agent-calculate-offer-instruction.md) | Agent instruction for calculate-offer |

### Runbooks (runtime, ops, integrations)

| Document                                                                                             | Role                                |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------- |
| [runbooks/manual-runtime-setup.md](runbooks/manual-runtime-setup.md)                                 | Local / dev runtime setup           |
| [runbooks/RUNTIME_CONFIG_MATRIX.md](runbooks/RUNTIME_CONFIG_MATRIX.md)                               | Env var names and roles             |
| [runbooks/configurator-smoke.md](runbooks/configurator-smoke.md)                                     | Configurator smoke checks           |
| [runbooks/REST_AUTH_AND_AGENT_KEY_VERIFICATION.md](runbooks/REST_AUTH_AND_AGENT_KEY_VERIFICATION.md) | REST auth / agent key               |
| [runbooks/PDF_CONVERTER_RUNTIME_VERIFICATION.md](runbooks/PDF_CONVERTER_RUNTIME_VERIFICATION.md)     | PDF converter runtime               |
| [runbooks/offer-generator-integration-audit.md](runbooks/offer-generator-integration-audit.md)       | Offer PDF / generator handoff audit |

### Ecosystem (cross-repo)

| Document                                                                                                       | Role                            |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| [ecosystem/README.md](ecosystem/README.md)                                                                     | Index + module responsibilities |
| [ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md](ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md)                               | Living integration table        |
| [ecosystem/TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md](ecosystem/TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md)           | When to update state doc        |
| [ecosystem/WORKSPACE_GOVERNANCE.md](ecosystem/WORKSPACE_GOVERNANCE.md)                                         | Multi-repo workspace layout     |
| [ecosystem/AGENT_BUSINESS_TOOLS.md](ecosystem/AGENT_BUSINESS_TOOLS.md)                                         | Agent tools mapping             |
| [ecosystem/TOPINSTAL_ECOSYSTEM_RULES_DESIGN.md](ecosystem/TOPINSTAL_ECOSYSTEM_RULES_DESIGN.md)                 | Ecosystem rules design          |
| [ecosystem/TOPINSTAL_ECOSYSTEM_TASK_RESPONSE_FORMAT.md](ecosystem/TOPINSTAL_ECOSYSTEM_TASK_RESPONSE_FORMAT.md) | Task response format            |

### Discovery and plans

| Document                                                   | Role               |
| ---------------------------------------------------------- | ------------------ |
| [discovery/repo-discovery.md](discovery/repo-discovery.md) | Repo discovery map |
| Migration plan (`docs/plans/migration-plan.md`)            | **Offloaded** — not in active repo; historical copy may live in workspace archive (`gmail-agent-offloaded-archive/`). Use `docs/architecture/repo-rules.md` and `memory-bank/decisions.md` for current direction. |
| Implementation backlog (`docs/IMPLEMENTATION_BACKLOG_FROM_DOCS.md`) | **Offloaded** — same archive; track open work via `memory-bank/active-context.md` and engine audits. |

### Tooling

| Document                                                                     | Role                        |
| ---------------------------------------------------------------------------- | --------------------------- |
| [tooling/mermaid-preview.md](tooling/mermaid-preview.md)                     | Mermaid preview             |
| [tooling/wordpress-mcp-self-hosted.md](tooling/wordpress-mcp-self-hosted.md) | WordPress MCP (self-hosted) |

### Agent narrative specs (non-canonical product docs)

Long-form agent research and specs live in [agent/](agent/README.md) (`AGENT_TOPINSTAL_FULL_SPEC.md`, `AGENT_HVAC_SKILLS_RESEARCH.md`, `AI_INPUT_CHANNELS_FUTURE_OPTIONS.md`). Canonical engineering rules remain under `architecture/` and `contracts/`.

### Panasonic catalog pipeline (added 2026-04-14)

| Document / Path                                                                | Role                                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ------- | --------- | ---------------------- | ------------------------------------------- |
| [`panasonic_catalog_update_workflow.md`](panasonic_catalog_update_workflow.md) | How to re-run the extraction pipeline for a new PDF                 |
| `data/normalized/catalog_items.jsonl`                                          | Canonical normalized catalog items (237 records, 10 categories)     |
| `knowledge/panasonic/`                                                         | Human + LLM oriented knowledge derived from normalized data         |
| `context/llm                                                                   | offering                                                            | service | selection | pricing/panasonic\_\*` | Context packets for applications and agents |
| `reports/panasonic_*`                                                          | Extraction QC, validation, pass2 repair summary, compare baseline   |
| `schemas/panasonic_*.schema.json`                                              | JSON schemas for catalog item, family, pricing fact, context packet |
| `tests/fixtures/panasonic_catalog_golden_records.json`                         | Golden test set (41 verified records)                               |

### Archive

Historical reports: [archive/README.md](archive/README.md)

## Documentation policy

- Keep active runtime guidance under `docs/` in the folders above.
- Legacy root filenames are mapped in **`COMPAT_POINTERS.md`** at the repo root (see [repo-rules](architecture/repo-rules.md)).
- When DTOs, REST, auth, trace semantics, generator integration, or mail-ingress workflow change, update [ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md](ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md) when other repos are affected.

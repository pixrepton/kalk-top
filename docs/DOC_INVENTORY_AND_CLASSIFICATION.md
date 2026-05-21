# Documentation Inventory And Classification

> Status: operational
> Owner: TOP-INSTAL documentation governance
> Last verified against code/runtime: 2026-04-14 (Panasonic pipeline + offer-PDF bootstrap additions)
> Source-of-truth level: L2
> Supersedes: none
> Related docs: `docs/DOC_GOVERNANCE.md`, `docs/SOURCE_OF_TRUTH_INDEX.md`, `docs/DOC_CONFLICTS_AND_GAPS.md`

## 1. Purpose

This inventory classifies the important documentation artifacts in the repo by role, class, owner, and trust level.

It intentionally focuses on project-significant docs, not every trivial file.

## 2. Inventory

| Path                                                           | Role                                                      | Class        | Owner                                     | Trust level | Notes                                                                                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------- | ------------ | ----------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                                    | repo execution rules and startup read order               | canonical    | repo owner / repo governance              | L0/L1       | strongest local execution authority for coding agent behavior                                                             |
| `.cursor/rules/00-topinstal-ecosystem-constitution.mdc`        | ecosystem-wide invariant rule                             | canonical    | ecosystem governance                      | L0/L1       | always-on rule                                                                                                            |
| `.cursor/rules/10-repo-role.mdc`                               | local repo role rule                                      | canonical    | repo governance                           | L0/L1       | always-on rule                                                                                                            |
| `.cursor/rules/20-execution-protocol.mdc`                      | execution protocol rule                                   | canonical    | repo governance                           | L0/L1       | always-on rule                                                                                                            |
| `docs/README.md`                                               | top-level docs index                                      | canonical    | documentation governance                  | L1          | index only, not contract truth                                                                                            |
| `docs/HANDBOOK.md`                                             | operator/contributor quick path                           | operational  | documentation governance                  | L2          | orientation and execution aid                                                                                             |
| `docs/SOURCE_OF_TRUTH_INDEX.md`                                | strict authority index                                    | canonical    | documentation governance                  | L1          | new primary authority router                                                                                              |
| `docs/DOC_GOVERNANCE.md`                                       | doc governance rules                                      | canonical    | documentation governance                  | L1          | defines class model and anti-drift process                                                                                |
| `docs/AGENT_EXECUTION_STANDARD.md`                             | coding-agent execution standard                           | canonical    | documentation governance                  | L1          | bridges AGENTS and doc trust model                                                                                        |
| `docs/READ_PRIORITY_MATRIX.md`                                 | read-first matrix by task type                            | canonical    | documentation governance                  | L1          | practical onboarding shortcut                                                                                             |
| `docs/TOPINSTAL_CANONICAL_ENTITY_MODEL.md`                     | shared entity vocabulary                                  | canonical    | architecture governance                   | L1          | cross-repo model of business/system entities                                                                              |
| `docs/TOPINSTAL_EVENT_MODEL.md`                                | shared event vocabulary                                   | canonical    | architecture governance                   | L1          | cross-repo operating event model                                                                                          |
| `docs/TOPINSTAL_AI_OS_BLUEPRINT.md`                            | future AI OS blueprint                                    | vision       | architecture direction                    | L4          | future-state by design; not runtime truth                                                                                 |
| `docs/DOC_INVENTORY_AND_CLASSIFICATION.md`                     | important-doc inventory                                   | operational  | documentation governance                  | L2          | this inventory                                                                                                            |
| `docs/DOC_CONFLICTS_AND_GAPS.md`                               | conflict/gap register                                     | operational  | documentation governance                  | L2          | explicit ambiguity tracker                                                                                                |
| `docs/IMPLEMENTATION_BACKLOG_FROM_DOCS.md`                     | doc-derived implementation backlog                        | operational  | documentation governance                  | L2          | rollout/backlog planning output                                                                                           |
| `docs/architecture/repo-rules.md`                              | local architecture and ownership rules                    | canonical    | repo governance                           | L1          | primary local architecture authority                                                                                      |
| `docs/architecture/boundary-map.md`                            | layer and cross-repo boundary map                         | canonical    | repo governance                           | L1          | high trust, concise                                                                                                       |
| `docs/architecture/change-surface-checklist.md`                | architecture review checklist                             | canonical    | repo governance                           | L1          | procedural but high-authority                                                                                             |
| `docs/architecture/decision-criteria.md`                       | architecture decision criteria                            | canonical    | repo governance                           | L1          | supports tradeoff decisions                                                                                               |
| `docs/architecture/APPLICATION_WORKFLOW_AND_ENGINES_README.md` | deep workflow and engine explanation                      | canonical    | architecture maintainer                   | L1          | long-form canonical explanation; higher drift risk due to size                                                            |
| `docs/contracts/API_CALCULATE_OFFER.md`                        | REST contract                                             | canonical    | contract owner                            | L1          | primary prose contract doc                                                                                                |
| `docs/contracts/dto-and-boundaries.md`                         | DTO boundary explanation                                  | canonical    | contract owner                            | L1          | strong contract boundary doc                                                                                              |
| `docs/contracts/field-mapping.md`                              | UI/mail -> DTO mapping                                    | canonical    | contract/form-flow owner                  | L1          | key mapper authority                                                                                                      |
| `docs/contracts/payload-field-classification.md`               | building payload classification                           | canonical    | contract/form-flow owner                  | L1          | key field-shape authority                                                                                                 |
| `docs/contracts/agent-calculate-offer-instruction.md`          | external agent integration guide                          | canonical    | contract owner                            | L1/L2       | integration-facing contract summary                                                                                       |
| `docs/contracts/README_NOWE_WEJSCIA_CALCULATE_OFFER.md`        | canonical guide for new input channels to calculate-offer | canonical    | documentation governance + contract owner | L1          | high-value synthesis doc                                                                                                  |
| `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`                  | cross-repo ownership/integration state                    | canonical    | ecosystem governance                      | L1          | primary cross-repo authority doc                                                                                          |
| `docs/ecosystem/TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md`        | when ecosystem state must change                          | canonical    | ecosystem governance                      | L1          | governance companion to ecosystem state                                                                                   |
| `docs/ecosystem/README.md`                                     | ecosystem doc index                                       | operational  | ecosystem governance                      | L2          | index, not authority by itself                                                                                            |
| `docs/ecosystem/schemas/*`                                     | static schema artifacts and schema index                  | transitional | ecosystem governance                      | L3          | helpful for tooling/reference, but not stronger than runtime or canonical contract docs                                   |
| `docs/runbooks/*`                                              | runtime/ops procedures                                    | operational  | subsystem maintainers                     | L2          | useful and task-specific; should not redefine contracts                                                                   |
| `docs/overview/*`                                              | broad orientation by layer                                | operational  | documentation governance                  | L2          | onboarding material, not primary source of truth                                                                          |
| `docs/agent/README.md`                                         | operational index for mixed agent material                | operational  | documentation governance                  | L2          | folder contents may be vision, research, or prompts; broader agent-runtime docs should eventually live outside `kalk-top` |
| `docs/agent/AGENT_TOPINSTAL_FULL_SPEC.md`                      | future agent operating model narrative                    | vision       | architecture/product owner                | L4          | useful future-state material; not runtime truth                                                                           |
| `docs/agent/AGENT_HVAC_SKILLS_RESEARCH.md`                     | market/research notes                                     | vision       | architecture/product owner                | L4          | research only                                                                                                             |
| `docs/agent/AI_INPUT_CHANNELS_FUTURE_OPTIONS.md`               | future input-channel backlog                              | vision       | architecture/product owner                | L4          | should not be mistaken for current runtime capability                                                                     |
| `docs/archive/*`                                               | historical reference                                      | transitional | documentation governance                  | L3          | reference only                                                                                                            |
| `memory-bank/project-brief.md`                                 | mission snapshot                                          | operational  | repo governance                           | L2          | high-signal memory file                                                                                                   |
| `memory-bank/current-state.md`                                 | condensed current architecture state                      | operational  | repo governance                           | L2          | should stay concise                                                                                                       |
| `memory-bank/active-context.md`                                | current working context                                   | operational  | active maintainer/agent                   | L2          | should be short-lived and high-signal                                                                                     |
| `memory-bank/progress.md`                                      | condensed milestone log                                   | operational  | active maintainer/agent                   | L2          | should avoid becoming full history                                                                                        |
| `memory-bank/decisions.md`                                     | stable decisions                                          | operational  | repo governance                           | L2          | high-value historical authority, but not contract truth by itself                                                         |

## 2b. Panasonic catalog layer (added 2026-04-14)

| Path                                                   | Role                                            | Class                | Trust level                 | Notes                                                      |
| ------------------------------------------------------ | ----------------------------------------------- | -------------------- | --------------------------- | ---------------------------------------------------------- | -------------------------------- | ------------------------------------------------ | --- | ------------------------------------------------ |
| `panasonic/`                                           | source PDFs for Panasonic product/price catalog | operational source   | L2                          | input-only; do not edit PDFs, run pipeline instead         |
| `scripts/panasonic_catalog_extract_v2.py`              | profiled extraction pipeline (production)       | operational          | L2                          | generates all downstream layers                            |
| `scripts/panasonic_catalog_validate.py`                | schema + QC validation                          | operational          | L2                          | run after extraction                                       |
| `tests/fixtures/panasonic_catalog_golden_records.json` | golden test set (41 records)                    | canonical            | L1                          | spatial-coordinate verified; do not relax without evidence |
| `tests/fixtures/panasonic_catalog_golden_test.py`      | golden test runner                              | canonical            | L1                          | must pass before promoting normalized layer                |
| `schemas/panasonic_catalog_item.schema.json`           | canonical catalog item schema                   | canonical            | L1                          | primary schema for catalog items                           |
| `schemas/panasonic_*.schema.json`                      | supporting schemas                              | canonical            | L1                          | family, pricing fact, context packet                       |
| `data/raw/panasonic_2026_*.json(l)`                    | raw extraction output                           | operational          | L2                          | reproducible; re-generate from PDF                         |
| `data/normalized/*.jsonl` and `*.json`                 | normalized catalog + indexes                    | operational          | L2                          | primary application-facing layer                           |
| `memory/entities                                       | relations                                       | facts/panasonic\_\*` | durable facts and relations | operational                                                | L2                               | derived from normalized; regenerate via pipeline |
| `knowledge/panasonic/`                                 | human + LLM oriented knowledge                  | operational          | L2                          | derived from normalized; do not edit manually              |
| `context/llm                                           | offering                                        | service              | selection                   | pricing/panasonic\_\*`                                     | context packets for applications | operational                                      | L2  | derived from normalized; regenerate via pipeline |
| `reports/panasonic_*`                                  | extraction QC, validation, repair summary       | operational          | L2                          | current run state                                          |
| `docs/panasonic_catalog_update_workflow.md`            | update procedure                                | operational          | L2                          | instructions for next PDF update                           |
| `panasonic/agent-skills/`                              | task-specific skill pack for PDF catalog work   | operational          | L2                          | complements global `.agents/skills/`                       |

## 3. Inventory summary by class

| Class        | Intent                                           |
| ------------ | ------------------------------------------------ |
| canonical    | stable truth and governance                      |
| operational  | guidance, runbooks, inventories, working context |
| transitional | historical or migration reference                |
| vision       | future-state and research material               |

## 4. Highest drift-risk documents

| Path                                                           | Why drift risk is high                                    |
| -------------------------------------------------------------- | --------------------------------------------------------- |
| `docs/architecture/APPLICATION_WORKFLOW_AND_ENGINES_README.md` | long and detailed; easy to become stale if not maintained |
| `docs/contracts/agent-calculate-offer-instruction.md`          | repeats auth/contract material from other docs            |
| `docs/contracts/README_NOWE_WEJSCIA_CALCULATE_OFFER.md`        | high-value synthesis doc spanning many sources            |
| `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`                  | broad scope across repos and integrations                 |
| `memory-bank/active-context.md`                                | naturally accumulates stale detail unless pruned          |
| `memory-bank/progress.md`                                      | naturally grows into long history unless condensed        |

## 5. Inventory use rule

Use this document to answer:

- which docs are important enough to maintain actively,
- which docs are authoritative,
- which docs should be read cautiously,
- where new material should be placed.

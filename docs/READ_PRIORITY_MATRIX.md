# Read Priority Matrix

> Status: canonical
> Owner: TOP-INSTAL documentation governance
> Last verified against code/runtime: 2026-06-04 (OZC backlog, PDF mapping audit)
> Source-of-truth level: L1
> Supersedes: none
> Related docs: `docs/AGENT_EXECUTION_STANDARD.md`, `docs/SOURCE_OF_TRUTH_INDEX.md`, `AGENTS.md`

## 1. Always read

These are the minimum starting reads for meaningful work in this repo.

1. `AGENTS.md`
2. `LOCAL_WORKSPACE_RULES.md`
3. `memory-bank/project-brief.md`
4. `memory-bank/current-state.md`
5. `memory-bank/active-context.md`
6. `.agents/SKILL_ROUTER.md`
7. `.cursor/rules/00-kalk-top-core-router.mdc`

Then use the matrix below. Load ecosystem/repo-role/execution rules on demand when paths match (see rule `globs`).

Agent harness / MCP / verify commands: `docs/dev/KALK_TOP_AGENT_HARNESS.md`.

## 2. Matrix

| Task type                         | Read next                                                                                                                                                                                                                                                      | Optional context                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Contract / DTO / REST             | `docs/SOURCE_OF_TRUTH_INDEX.md`, `docs/contracts/API_CALCULATE_OFFER.md`, `docs/contracts/dto-and-boundaries.md`, `docs/contracts/field-mapping.md`, `docs/contracts/payload-field-classification.md`, `docs/contracts/README_NOWE_WEJSCIA_CALCULATE_OFFER.md` | `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`, fixtures, validators         |
| Runtime / auth / wiring           | `docs/SOURCE_OF_TRUTH_INDEX.md`, `docs/runbooks/manual-runtime-setup.md`, `docs/runbooks/REST_AUTH_AND_AGENT_KEY_VERIFICATION.md`, `docs/runbooks/RUNTIME_CONFIG_MATRIX.md`                                                                                    | `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`, smoke runbooks               |
| UI / form flow / configurator     | `docs/contracts/field-mapping.md`, `docs/contracts/payload-field-classification.md`, `docs/discovery/repo-discovery.md`, relevant nested `AGENTS.md`                                                                                                           | overview docs, configurator inventory docs                                  |
| Architecture / multi-layer change | `docs/SOURCE_OF_TRUTH_INDEX.md`, `docs/architecture/repo-rules.md`, `docs/architecture/boundary-map.md`, `docs/architecture/change-surface-checklist.md`, `docs/architecture/decision-criteria.md`                                                             | `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`                               |
| Generator / ingress / ecosystem   | `docs/SOURCE_OF_TRUTH_INDEX.md`, `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`, `docs/ecosystem/TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md`, `docs/architecture/offer-dto-pdf-mapping-audit.md`, relevant runbooks                                              | `docs/architecture/BACKLOG_RESOLUTIONS_2026-06-04.md`, `docs/runbooks/offer-generator-integration-audit.md` |
| OZC / heating engines             | `docs/architecture/ozc-professional-method-audit.md` § Code sync status, `docs/architecture/BACKLOG_RESOLUTIONS_2026-06-04.md`, `core/domain/ozc/OzcEngine.php`                                                                                              | `docs/architecture/engine-graphs/ozc.graph.md`, `ozc-full-audit.regression.php` |
| Doc-only governance work          | `docs/DOC_GOVERNANCE.md`, `docs/SOURCE_OF_TRUTH_INDEX.md`, `docs/AGENT_EXECUTION_STANDARD.md`                                                                                                                                                                  | `docs/README.md`, `docs/HANDBOOK.md`                                        |
| Agent / operating-model work      | `docs/AGENT_EXECUTION_STANDARD.md`, `docs/TOPINSTAL_CANONICAL_ENTITY_MODEL.md`, `docs/TOPINSTAL_EVENT_MODEL.md`                                                                                                                                                | offloaded vision docs, ecosystem docs                                       |

## 3. Optional orientation docs

Read only when you need orientation, not authority:

- `docs/README.md`
- `docs/HANDBOOK.md`
- offloaded `docs/overview/*` (see HANDBOOK layer map)

## 4. Treat with caution

Read as non-canonical unless explicitly needed:

- offloaded `docs/archive/*` (see `gmail-agent-offloaded-archive/kalk-top-docs-2026-05-30/docs/archive/`)
- `docs/agent/AGENT_TOPINSTAL_FULL_SPEC.md`
- `docs/agent/AGENT_HVAC_SKILLS_RESEARCH.md`
- `memory-bank/progress.md` for current milestones only, not canonical architecture
- `.runtime-wp/*`

## 5. Fast rule

If time is short:

- read authority docs first,
- read overview second,
- read vision only when the task is explicitly future-state.

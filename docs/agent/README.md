# Agent docs (narrative / research)

> Status: operational
> Owner: TOP-INSTAL documentation governance
> Last verified against code/runtime: 2026-04-03 (classification reconciliation pass)
> Source-of-truth level: L2
> Supersedes: none
> Related docs: `docs/TOPINSTAL_AI_OS_BLUEPRINT.md`, `docs/AGENT_EXECUTION_STANDARD.md`, `docs/SOURCE_OF_TRUTH_INDEX.md`

This folder is an **operational index** for agent-related materials.

Most files in this folder are **vision**, **research**, or **future-state design**, not canonical engineering rules. Use each file's own status marker before treating it as authority.

Broader agent-runtime architecture and cross-project Cursor/process docs should ultimately live outside `kalk-top` in a separate runtime/project repo. This folder should stay focused on boundary-facing summaries relevant to `kalk-top`.


| File                                                                           | Role                                                                                                            |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| [AGENT_TOPINSTAL_FULL_SPEC.md](AGENT_TOPINSTAL_FULL_SPEC.md)                   | Extended agent specification (sections 1–18), tools, autonomy, prompts                                          |
| [AGENT_HVAC_SKILLS_RESEARCH.md](AGENT_HVAC_SKILLS_RESEARCH.md)                 | HVAC agent skills research and market survey notes                                                              |
| [AI_INPUT_CHANNELS_FUTURE_OPTIONS.md](AI_INPUT_CHANNELS_FUTURE_OPTIONS.md)     | Future backlog of modern AI / voice / chat / document input channels that may feed `calculate-offer`           |

**Canonical repo rules and contracts** (edit these for boundary / DTO / REST truth):

- [../architecture/repo-rules.md](../architecture/repo-rules.md)
- [../contracts/dto-and-boundaries.md](../contracts/dto-and-boundaries.md)
- [../contracts/field-mapping.md](../contracts/field-mapping.md)
- [../discovery/repo-discovery.md](../discovery/repo-discovery.md)
- [../plans/migration-plan.md](../plans/migration-plan.md)
- [../runbooks/manual-runtime-setup.md](../runbooks/manual-runtime-setup.md)
- [../tooling/mermaid-preview.md](../tooling/mermaid-preview.md)

**Cross-repo context:** [../ecosystem/README.md](../ecosystem/README.md) (module responsibilities and links to `TOPINSTAL_ECOSYSTEM_STATE.md`).

Small transitional pointer files that used to duplicate the above paths were removed; use [../README.md](../README.md) as the full documentation index.

Do not treat this folder as stronger authority than:

- `AGENTS.md`
- `.cursor/rules/*`
- `docs/contracts/*`
- `docs/architecture/*`
- `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`

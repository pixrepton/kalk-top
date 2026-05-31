# Agent Skill Router

Status: active routing file for `kalk-top`. Route only; do not duplicate skill procedures here.

## Default

1. Read `AGENTS.md`.
2. Read `LOCAL_WORKSPACE_RULES.md`.
3. Read `memory-bank/project-brief.md`, `memory-bank/current-state.md`, `memory-bank/active-context.md`.
4. Select the smallest relevant skill set below (max 1–3 skills).
5. Read only selected `SKILL.md` files and task-relevant references.

## Task To Skill

| Task type                               | Read / use                                                                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start / unfamiliar area                 | `.agents/skills/kalk-top-repo-discovery-map/SKILL.md`, `docs/discovery/repo-discovery.md`                                                           |
| Contract / DTO / REST                   | `.agents/skills/kalk-top-contract-impact-check/SKILL.md`, `docs/contracts/*`, `docs/READ_PRIORITY_MATRIX.md`                                        |
| Form / payload / calculator UI          | `.agents/skills/kalk-top-calculator-form-flow-tracer/SKILL.md`, `docs/contracts/field-mapping.md`, `docs/contracts/payload-field-classification.md` |
| WP runtime / auth / wiring              | `.agents/skills/kalk-top-wp-runtime-verifier/SKILL.md`, `docs/runbooks/manual-runtime-setup.md`                                                     |
| Visible UI / smoke                      | `.agents/skills/kalk-top-ui-runtime-check/SKILL.md`, `npm run test:e2e`, Playwright MCP or Browser                                                  |
| Funnel / operator traceability          | `docs/runbooks/funnel-traceability.md`, WP admin **TOP-INSTAL → Lejek / Sukcesy**                                                                   |
| Architecture / multi-layer              | `.agents/skills/kalk-top-architecture-review/SKILL.md`, `docs/architecture/*`                                                                       |
| Change surface / ownership              | `.agents/skills/kalk-top-change-surface-map/SKILL.md`, `docs/architecture/change-surface-checklist.md`                                              |
| Debug / regression                      | `.agents/skills/kalk-top-debug-repro-loop/SKILL.md`                                                                                                 |
| OfferDTO / pricing / generator boundary | `knowledge/agent-os/skills/kalk-top-offerdto-contract/SKILL.md`, `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`                                      |
| Coding, review, refactor discipline     | `knowledge/agent-os/skills/karpathy-guidelines/SKILL.md`                                                                                            |
| Prompt / handoff / agent DoD            | `knowledge/agent-os/skills/cursor-codex-harness/SKILL.md`, `docs/dev/KALK_TOP_AGENT_HARNESS.md`                                                     |
| Rules/skills/context bloat audit        | `knowledge/agent-os/skills/context-budget-audit/SKILL.md`                                                                                           |
| Static graph / impact / call chain      | `knowledge/agent-os/skills/gitnexus-static-repo-intel/SKILL.md`, `docs/dev/KALK_TOP_GITNEXUS.md`                                                    |
| Gmail / Daszek / Node B proof           | `gmail-agent/AGENTS.md`, `gmail-agent/.agents/skills/gmail-agent-proof-run/SKILL.md` (other repo)                                                   |

## Do Not Use As Default Context

- `.runtime-wp/**`
- `docs/archive/**`
- `.gitnexus/**`
- `test-results/**`
- `node_modules/**`
- raw prompt dumps at repo root

## Notes

- GitNexus is dev-only static intelligence, not live WordPress or REST proof.
- Animation MCPs (Framer/GSAP) are optional via `npm run mcp:framer-motion` / `mcp:animation`, not project MCP defaults.
- Prefer `kalk-top-repo-assistant` MCP for contract/runtime orientation; verify with file reads and `npm run` harnesses.

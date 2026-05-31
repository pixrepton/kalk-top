# kalk-top — skill router

**Status:** 2026-05-30 — route only; procedures live in `SKILL.md` targets below.
**Master (ecosystem):** `knowledge/agent-os/SKILL_ROUTER.md`

## Skills

| Skill                                | Lokalizacja                                                     | Uwaga     |
| ------------------------------------ | --------------------------------------------------------------- | --------- |
| karpathy-guidelines                  | `knowledge/agent-os/skills/karpathy-guidelines/SKILL.md`        | kanon     |
| context-budget-audit                 | `knowledge/agent-os/skills/context-budget-audit/SKILL.md`       | kanon     |
| gitnexus-static-repo-intel           | `knowledge/agent-os/skills/gitnexus-static-repo-intel/SKILL.md` | kanon     |
| cursor-codex-harness                 | `knowledge/agent-os/skills/cursor-codex-harness/SKILL.md`       | kanon     |
| kalk-top-offerdto-contract           | `knowledge/agent-os/skills/kalk-top-offerdto-contract/SKILL.md` | kanon     |
| kalk-top-architecture-review         | `.agents/skills/kalk-top-architecture-review/SKILL.md`          | repo-only |
| kalk-top-calculator-form-flow-tracer | `.agents/skills/kalk-top-calculator-form-flow-tracer/SKILL.md`  | repo-only |
| kalk-top-change-surface-map          | `.agents/skills/kalk-top-change-surface-map/SKILL.md`           | repo-only |
| kalk-top-contract-impact-check       | `.agents/skills/kalk-top-contract-impact-check/SKILL.md`        | repo-only |
| kalk-top-debug-repro-loop            | `.agents/skills/kalk-top-debug-repro-loop/SKILL.md`             | repo-only |
| kalk-top-repo-discovery-map          | `.agents/skills/kalk-top-repo-discovery-map/SKILL.md`           | repo-only |
| kalk-top-ui-runtime-check            | `.agents/skills/kalk-top-ui-runtime-check/SKILL.md`             | repo-only |
| kalk-top-wp-runtime-verifier         | `.agents/skills/kalk-top-wp-runtime-verifier/SKILL.md`          | repo-only |
| openrouter-typescript-sdk            | `.agents/skills/openrouter-typescript-sdk/SKILL.md`             | repo-only |

## Default read order

1. `AGENTS.md`
2. `LOCAL_WORKSPACE_RULES.md`
3. `memory-bank/project-brief.md`, `current-state.md`, `active-context.md`
4. Ten plik → wybierz 1–3 wiersze z tabeli
5. Otwórz **Lokalizacja** (kanon = agent-os; repo-only = `.agents/skills/…`)

## Do not load by default

- `.runtime-wp/**`, `docs/archive/**`, `.gitnexus/**`, `test-results/**`, `node_modules/**`

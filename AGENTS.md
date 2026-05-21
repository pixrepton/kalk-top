# AGENTS.md

## Repo identity

`kalk-top` is the TOP-INSTAL decision layer. This repo is the source of truth for HVAC calculation, selection, buffer, pricing, and offer generation.

## Primary technical goal

Keep the backend-first flow canonical: `CalcRequestDTO -> OfferDTO` through `POST /wp-json/topinstal/v1/calculate-offer`.

## Startup read order

1. `AGENTS.md` (this file)
2. `LOCAL_WORKSPACE_RULES.md`
3. `memory-bank/project-brief.md`
4. `memory-bank/current-state.md`
5. `memory-bank/active-context.md`
6. `.agents/SKILL_ROUTER.md` — pick max 1–3 skills before broad doc scans
7. `.cursor/rules/00-kalk-top-core-router.mdc`
8. nearest nested `AGENTS.md` for the subsystem you are editing
9. optional per-layer deep dive: `docs/overview/README_TOP-INSTAL_HVAC_Calculator_*.md` (Core, WP-Adapter, Kalkulator, Konfigurator, Frontend API) - see `docs/overview/README_TOP-INSTAL_HVAC_Calculator.md` -> "Module READMEs"

On-demand rules (loaded when matching paths): `00-topinstal-ecosystem-constitution`, `10-repo-role`, `20-execution-protocol`, `30-kalk-top-agent-harness`, `karpathy-guidelines`.

## Task routing

Use `.agents/SKILL_ROUTER.md` first, then open only the docs/skills that row requires.

- Bugfix or refactor: read `docs/architecture/repo-rules.md`; skill `kalk-top-debug-repro-loop` or `karpathy-guidelines`.
- Documentation governance, repo operating model, or agent-execution work: read `docs/SOURCE_OF_TRUTH_INDEX.md`, `docs/DOC_GOVERNANCE.md`, `docs/READ_PRIORITY_MATRIX.md`, and `docs/AGENT_EXECUTION_STANDARD.md`.
- Contract, DTO, or REST change: read `docs/contracts/*` (including `payload-field-classification.md` for building payload shape) and `docs/ecosystem/*`; use the contract-impact skill and architecture-review when the change is cross-cutting.
- Runtime or setup issue: read `docs/runbooks/manual-runtime-setup.md`; use the WP runtime verifier. Prefer Debug Mode if the cause is unclear.
- Calculator or form-flow issue: read `docs/contracts/field-mapping.md`, `docs/contracts/payload-field-classification.md`, and `docs/discovery/repo-discovery.md`; use the form-flow tracer and Browser for visible verification.
- Configurator pricing vs backend: **canonical money is always `OfferDTO` from `calculate-offer`**; visible runtime pricing is backend-only, and missing backend offer must surface a waiting/unavailable state instead of JS retail totals - see `konfigurator/AGENTS.md` (Pricing authority).
- Mail-ingress or integration issue: if the work is about Gmail/Groq intake, Daszek, or the moved mail-ingress bridge/docs, switch to `gmail-agent/AGENTS.md` and edit under `gmail-agent/` as canonical; otherwise read `docs/ecosystem/*`, `docs/discovery/repo-discovery.md`, and relevant runbooks.
- Architecture or multi-layer change: start in Plan Mode, use `docs/architecture/*`, and use the architecture-review or change-surface-map skill before coding.

## Cursor-native capabilities

- MCP `kalk-top-repo-assistant`: contract surface, runtime preflight, route/auth, architecture review inputs (verify with file reads).
- MCP `playwright`: visible UI smoke on allowed hosts (include `127.0.0.1` / `localhost` for dev).
- Funnel / operator traceability: `docs/runbooks/funnel-traceability.md` (WP admin **TOP-INSTAL → Lejek / Sukcesy**).
- Slash commands: `.cursor/commands/verify-*.md`, `runtime-preflight.md` — tiered local verification.
- Plan Mode: use for multi-file, architectural, or unclear work.
- Debug Mode: use for regressions, timing issues, runtime ambiguity, or failed read-and-patch attempts.
- Browser: use for visible UI changes, smoke checks, console evidence, and network evidence.
- Parallel agents and worktrees: use for hard refactors or comparing alternatives, not routine edits.
- Agent harness map: `docs/dev/KALK_TOP_AGENT_HARNESS.md`.

## Workspace warning

Edit the repo root as canonical. Do not edit mirrored files under `.runtime-wp/` unless the user explicitly asks.

For Gmail Intake / Daszek / moved mail-ingress bridge work, the canonical root now lives under `gmail-agent/`. Outer-root paths such as `tools/gmail_audit/*`, `wp-adapter/mail-ingress/*`, and `Daszek/*` are compatibility wrappers or pointer stubs unless the task is explicitly about wrapper maintenance.

## Verification defaults

- Use the lightest relevant verification first.
- Prefer `npm run verify` for broad repo checks.
- Prefer `npm run test:contract`, `npm run test:fixtures`, or `npm run test:rest` for offer-boundary work.
- Mail-ingress integration smoke: run in **`topinstal-mail-ingress`**; scripts of the same name in this repo are stubs that only print a pointer.
- Prefer Browser for visible UI verification and Debug Mode for evidence-first debugging.
- Report what you actually ran.

## Post-task updates

After meaningful work, update:

- `memory-bank/active-context.md`
- `memory-bank/progress.md`

Update these when needed:

- `memory-bank/decisions.md`
- `memory-bank/open-questions.md`
- `memory-bank/current-state.md`

## Cross-repo escalation

If work touches DTOs, REST contracts, auth/trace semantics, generator integration, or mail-ingress workflow, read:

- `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`
- `docs/ecosystem/TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md`

Then state explicit impact on downstream modules and whether ecosystem docs must change.

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **kalk-top** (8615 symbols, 15106 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource                                  | Use for                                  |
| ----------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/kalk-top/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/kalk-top/clusters`       | All functional areas                     |
| `gitnexus://repo/kalk-top/processes`      | All execution flows                      |
| `gitnexus://repo/kalk-top/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                         | Read this skill file                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->

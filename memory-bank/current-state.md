# Current State

## TOP-INSTAL multi-repo ecosystem (outside this repo)

- Canonical cross-repo contracts and integration table: `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`
- Human workspace order (Desktop layout, Cursor, archives): `docs/ecosystem/WORKSPACE_GOVERNANCE.md`
- Visual browser map (Mermaid): `docs/ecosystem/ECOSYSTEM_MAP.html`
- `gmail-agent/` now exists as a separate top-level cockpit for Gmail Intake, Daszek, and the moved mail-ingress bridge/docs inside this workspace.
- **kalk-top** remains source of truth for calculation and `OfferDTO`; **top-instal-generator** for documents; **topinstal-mail-ingress** for Gmail ingress; **topinstal-cieplo-orchestrator** for VPS automation after ingress (optional vs direct `mail-ingress` → kalk-top); **RAG Chat Asystent** for KB; **agent-zordon** for LLM tool-calling — see ecosystem docs for endpoints

## Architecture truth

- Repo root is the canonical workspace
- `.runtime-wp/wordpress/wp-content/plugins/topinstal-heatpump-calculator/` is a link-based runtime projection of the repo root, not a copied mirror
- backend-first calculation exists and is controlled by `USE_BACKEND_CALC` or equivalent runtime option
- canonical offer boundary is `POST /wp-json/topinstal/v1/calculate-offer`
- visible pricing in configurator runtime, step 10, and document payload assembly is now backend-only from `OfferDTO`; additive traceability lives in `pricing.source` and `pricing.catalogVersion`
- canonical OZC path is native `TopInstal_OzcEngine_Full` only (`core/domain/ozc/OzcEngine.php`); browser `ozc-engine.js` and JS parity harness removed; rollback is `USE_FULL_OZC_ENGINE=false` (MVP PHP, not JS)
- canonical CWU path now exists as native `TopInstal_CwuEngine`; `engineering.cwu` is additive in `OfferDTO`, while `engineering.ozc.hotWaterPower_kW` remains for compatibility
- `CalculateOfferUseCase` now normalizes heating, climate, and bivalent aliases before calling domain engines

## Main execution areas

- bootstrap: `heatpump-calculator.php`
- application orchestration: `core/application/CalculateOfferUseCase.php`
- domain engines: `core/domain/*` (`ozc`, `selection`, `buffer`, `pricing`, `cwu`)
- WP adapters: `wp-adapter/rest/*`; outer-root `wp-adapter/mail-ingress/*` is now compatibility-only and the canonical bridge lives under `gmail-agent/wp-adapter/mail-ingress/*`
- calculator UI: `kalkulator/*`, `frontend/*`, `konfigurator/*`

## Local instruction map

- root operator guide: `AGENTS.md`
- agent navigation: `memory-bank/navigation.md`
- workspace guardrails: `LOCAL_WORKSPACE_RULES.md`
- authority and read-order guide: `docs/SOURCE_OF_TRUTH_INDEX.md`, `docs/READ_PRIORITY_MATRIX.md`
- documentation governance and agent standard: `docs/DOC_GOVERNANCE.md`, `docs/AGENT_EXECUTION_STANDARD.md`
- operating-model docs: `docs/TOPINSTAL_CANONICAL_ENTITY_MODEL.md`, `docs/TOPINSTAL_EVENT_MODEL.md`, `docs/TOPINSTAL_AI_OS_BLUEPRINT.md`
- domain-local guide: `core/domain/AGENTS.md`
- application-local guide: `core/application/AGENTS.md`
- runtime-local guide: `wp-adapter/AGENTS.md`
- calculator-local guide: `kalkulator/AGENTS.md`
- configurator-local guide: `konfigurator/AGENTS.md`

## Current verification surface

- `npm run verify` — JS syntax + regressions, pricing presentation parity, canonical pricebook guard, PHP lint, `test:contract`, `test:fixtures`, optional REST (env-gated); **does not** run mail-ingress (that integration lives outside this workspace)
- `npm run test:contract`
- `npm run test:fixtures`
- `npm run test:engine-parity` — reference parity (PHP vs canonical JS); run explicitly when touching engines/pricing selection
- `npm run test:mail-ingress-workflow` / `test:mail-ingress-live` — no-op stubs that print a pointer to `topinstal-mail-ingress` (legacy npm script names preserved)
- `npm run test:rest`

## Agent harness (2026-05)

- Always-on router: `.cursor/rules/00-kalk-top-core-router.mdc`
- Skill routing: `.agents/SKILL_ROUTER.md` + domain skills under `.agents/skills/*`
- Workspace guardrails: `LOCAL_WORKSPACE_RULES.md`
- MCP (project): `kalk-top-repo-assistant`, `playwright` in `.cursor/mcp.json` (animation MCPs remain `npm run mcp:*` only)
- Harness map: `docs/dev/KALK_TOP_AGENT_HARNESS.md`; GitNexus: `docs/dev/KALK_TOP_GITNEXUS.md`
- Codex: `.codex/` with `SHARED_AGENT_BASE.md` and `reviewer` / `php-pro` / `typescript-pro` agents
- Slash commands: `.cursor/commands/verify-*.md`, `runtime-preflight.md`
- Hooks: `after-file-edit-lint` for PHP/JS syntax on canonical paths

## Active Cursor capability surface

- Plan Mode for multi-file and architectural work
- Debug Mode for evidence-first debugging
- Browser for UI/runtime smoke checks and visual verification
- project rules in `.cursor/rules/*`
- memory bank continuity in `memory-bank/*`
- repo-local skills in `.agents/skills/*`
- project MCP configuration in `.cursor/mcp.json`
- a second Cursor / memory-bank cockpit now lives under `gmail-agent/` for Gmail intake work

## Active seams

- public `POST /wp-json/topinstal/v1/calculate-offer` still accepts optional `ozcResult`, so trusted integrations can bypass backend OZC unless that contract is narrowed or gated
- frontend configurator still ships local engine helpers for legacy/reference mode, but backend mode now renders pump/pricing/hydraulics from canonical backend `OfferDTO`
- ecosystem contracts are documented in `docs/ecosystem/*`
- documentation governance now explicitly separates canonical / operational / transitional / vision material, but long-form docs and copied schema artifacts still need disciplined upkeep to avoid future drift
- broader future agent runtime and cross-project Cursor/process docs are intentionally expected to live outside `kalk-top`; this repo keeps only local execution rules and boundary-facing summaries
- repo-local agent operating system now uses memory bank + compact rules + category docs + repo skills
- V3 adds subsystem-local `AGENTS.md`, architecture review artifacts, and evidence-first workflow routing
- PHP parity OZC still exists as rollback/comparison path, and direct JS parity now exists only as reference harness rather than active runtime

## Update rule

Read before meaningful work. Update when the repo's real architecture, canonical paths, or verification surface materially changes.

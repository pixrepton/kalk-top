# Navigation

Short map for agents. Details live in source and canonical docs.

## Bootstrap and boundary

- Plugin bootstrap: `heatpump-calculator.php`
- Canonical REST: `wp-adapter/rest/` → `POST /wp-json/topinstal/v1/calculate-offer`
- Application: `core/application/CalculateOfferUseCase.php`

## Domain (pure)

- `core/domain/` — OZC, selection, buffer, pricing, CWU
- Guide: `core/domain/AGENTS.md`

## UI layers

- Calculator: `kalkulator/` — `kalkulator/AGENTS.md`
- Configurator: `konfigurator/` — pricing authority in `konfigurator/AGENTS.md`
- Frontend API: `frontend/api/`

## Agent harness

- `AGENTS.md`, `LOCAL_WORKSPACE_RULES.md`
- `.agents/SKILL_ROUTER.md`
- `docs/dev/KALK_TOP_AGENT_HARNESS.md`
- `.cursor/mcp.json` — `kalk-top-repo-assistant`, `playwright`

## Contracts and ecosystem

- `docs/contracts/API_CALCULATE_OFFER.md`
- `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`
- `docs/SOURCE_OF_TRUTH_INDEX.md`

## OZC / backlog (2026-06-04)

- Session closeout: `docs/architecture/BACKLOG_RESOLUTIONS_2026-06-04.md`
- OZC audit + code sync: `docs/architecture/ozc-professional-method-audit.md`
- **Open P7:** `docs/architecture/offer-dto-pdf-mapping-audit.md` → `memory-bank/open-questions.md`

## Verification

- `npm run test:contract` — offer boundary + OZC regressions
- `npm run proof` — runtime **8091** + Playwright `@critical`
- `npm run test:fixtures`
- `npm run verify:js` — JS syntax sweep
- `npm run test:rest` — needs `TOPINSTAL_REST_BASE_URL`

## Runtime (non-canonical edit target)

- `.runtime-wp/` — mirror only; do not edit unless asked

## Sibling repo (multi-root)

- `gmail-agent/` — Gmail intake, Daszek, mail-ingress bridge

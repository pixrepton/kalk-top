# Shared Codex discipline (kalk-top)

Canonical rules supplementing `.codex/agents/*.toml` developer_instructions.

## Read order

1. `AGENTS.md`
2. `LOCAL_WORKSPACE_RULES.md`
3. `memory-bank/project-brief.md`, `memory-bank/current-state.md`, `memory-bank/active-context.md`
4. `.agents/SKILL_ROUTER.md`
5. `docs/dev/KALK_TOP_AGENT_HARNESS.md`
6. Nearest nested `AGENTS.md`
7. Task-relevant source and harness tests only

Do not scan the whole repo or load `docs/archive/**`, `.runtime-wp/**`, `.gitnexus/**` by default.

## Boundaries

- **kalk-top** owns `CalcRequestDTO -> OfferDTO`, calculation, selection, buffer, pricing.
- Canonical REST: `POST /wp-json/topinstal/v1/calculate-offer`.
- **top-instal-generator** renders documents; does not own offer semantics.
- **gmail-agent** / mail-ingress own intake transport; not calculation here.
- Repo root is canonical; `.runtime-wp/` is runtime projection only.
- Local files are not live WordPress or production REST proof without runtime evidence.

## Verification

- Offer boundary: `npm run test:contract`, `npm run test:fixtures`
- REST: `npm run test:rest` (requires `TOPINSTAL_REST_BASE_URL`)
- UI JS: `npm run verify:js`
- Harness check: `node scripts/agent-harness-preflight.mjs`

## Response format

1. Boundary (module/path)
2. Problem or risk
3. Smallest fix
4. What was run / confirmed locally vs needs runtime
5. Residual risk

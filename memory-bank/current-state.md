# Current State

## TOP-INSTAL multi-repo ecosystem (outside this repo)

- Canonical cross-repo contracts and integration table: `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`
- Human workspace order (Desktop layout, Cursor, archives): `docs/ecosystem/WORKSPACE_GOVERNANCE.md`
- Visual browser map (Mermaid): `docs/ecosystem/ECOSYSTEM_MAP.html`
- `gmail-agent/` — Gmail Intake, Daszek, mail-ingress bridge (separate workspace)
- **kalk-top** = calculation + `OfferDTO`; **top-instal-generator** = offer PDF; see ecosystem docs for endpoints

## Architecture truth

- Repo root is canonical; `.runtime-wp/.../topinstal-heatpump-calculator/` is link-based runtime projection
- Canonical boundary: `POST /wp-json/topinstal/v1/calculate-offer` → `OfferDTO`
- OZC: native `TopInstal_OzcEngine_Full` only (`core/domain/ozc/OzcEngine.php`)
- Visible pricing: backend-only from `OfferDTO`; configurator renders from canonical response
- CWU: native `TopInstal_CwuEngine`; `engineering.cwu` additive in `OfferDTO`

## Building / OZC model (owner, 2026-06-04)

- `floor_area` = **brutto** (with external walls); netto after `wall_size`
- User does not enter `heated_area` — derived from `building_heated_floors[]` + roof/basement rules
- Attic correction (`steep`) **only** when Poddasze checked (`building_floors + 1` in heated floors)
- Annual energy: HDD × `H_total_for_HDD` × `utilizationFactor=0.72` (non-certificate); SCOP 4 for costs

Full session record: `docs/architecture/BACKLOG_RESOLUTIONS_2026-06-04.md`

## Main execution areas

- bootstrap: `heatpump-calculator.php`
- orchestration: `core/application/CalculateOfferUseCase.php`
- domain: `core/domain/*`
- WP: `wp-adapter/rest/*`; offer PDF: `wp-adapter/mail-ingress/OfferDocumentsGeneratorClient.php`
- UI: `kalkulator/*`, `konfigurator/*`, `frontend/*`

## Verification surface

- `npm run test:contract` — engines, OZC attic regression, heating costs, offer smoke
- `npm run proof` — verify + Playwright `@critical` + soft (runtime **8091**)
- `npm run test:rest` — REST e2e (env-gated)
- **Removed:** `test:engine-parity` — use `test:contract` + `ozc-full-audit.regression.php`

Local runtime: `KALK_TOP_RUNTIME_PORT=8091`, calculator `http://127.0.0.1:8091/?page_id=5`

## Active seams / open work

| Item | Status |
|------|--------|
| **Problem 7 — OfferDTO → offer PDF mapping** | Audited; **implementation open** in `top-instal-generator` — `docs/architecture/offer-dto-pdf-mapping-audit.md` |
| P0-2 `floor_area` netto in `computeGeometry` | Open (model); form gates limit bad UI payloads |
| P0-5 static SCOP | Open; owner accepts SCOP 4 |
| `ozcResult` REST bypass | **Intentional** (owner) — not a bug |
| Dual PDF: energy report vs commercial offer | Documented; different code paths |

## Documentation authority

- Session closeout: `docs/architecture/BACKLOG_RESOLUTIONS_2026-06-04.md`
- OZC audit + code sync: `docs/architecture/ozc-professional-method-audit.md`
- PDF mapping audit: `docs/architecture/offer-dto-pdf-mapping-audit.md`
- Index: `docs/SOURCE_OF_TRUTH_INDEX.md`
- Agent harness: `docs/dev/KALK_TOP_AGENT_HARNESS.md`

## Update rule

Read before meaningful work. Update when architecture, canonical paths, verification surface, or backlog status materially changes.

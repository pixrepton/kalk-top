# Active Context

## Current focus (2026-06-04)

**OZC backlog 1–8 closed in code/docs; Problem 7 (PDF mapping) is the main remaining implementation track.**

| Done | Item |
|------|------|
| ✓ | Poddasze gate (`steep` + explicit floor only) — `OzcEngine.php` |
| ✓ | Annual energy `utilizationFactor=0.72` — P1 HDD mitigation |
| ✓ | Runtime proof on port **8091**, REST BOM guard, Playwright E2E pricing |
| ✓ | Problem 1 analysis — form gates vs engine edge paths |
| ✓ | Problem 7 **audit** — `offer-dto-pdf-mapping-audit.md` |
| ✓ | Commit `152cca1` |

| Open | Item |
|------|------|
| **→** | **Problem 7 implementation** — map OZC + pricing items into `top-instal-generator` offer PDF |
| → | P0-2 floor_area/netto model alignment in `computeGeometry` (low UI risk) |

## Canonical references

- Full session record: `docs/architecture/BACKLOG_RESOLUTIONS_2026-06-04.md`
- OZC code sync table: `docs/architecture/ozc-professional-method-audit.md` § Code sync status
- PDF field matrix + OPEN WORK: `docs/architecture/offer-dto-pdf-mapping-audit.md`
- Open question pointer: `memory-bank/open-questions.md`

## Owner decisions (do not re-open without ask)

- Pump range gaps, Panasonic catalog sync, `ozcResult` bypass — removed from backlog
- SCOP 4 static — accepted
- P0-6 CO/CWU cost split — out of scope
- `floor_area` = brutto; heated area from form floors, not user `heated_area` field

## Verification

```powershell
cd kalk-top
npm run test:contract
$env:KALK_TOP_RUNTIME_PORT="8091"
npm run proof
```

## Cross-repo memory

- Engram: `knowledge/memory/engrams/2026-06-04-kalk-top-ozc-pdf-docs-sync.md`
- Workspace: `knowledge/memory/ACTIVE_WORKSPACE.md`, `LAST_SESSION.md`

## Update rule

Keep short and current. Durable truth → canonical docs under `docs/`. Stable decisions → `decisions.md`.

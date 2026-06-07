# Open Questions

## Active — Problem 7 (OfferDTO → commercial offer PDF)

**Status:** Analysis complete (2026-06-04); **implementation not started.**

**Goal:** Extend `top-instal-generator` so the commercial offer PDF (not the energy report) carries business-critical fields from `OfferDTO` + `machineRoomSnapshot`.

**Canonical audit:** `docs/architecture/offer-dto-pdf-mapping-audit.md`  
**Backlog / references:** `docs/architecture/BACKLOG_RESOLUTIONS_2026-06-04.md` §8

### P0 implementation tasks

1. Map `engineering.ozc.designHeatLoss_kW` and `heatedArea_m2` into Word template placeholders.
2. Map `pricing.items[]` (line summary + total) — configurator already computes items in `OfferDTO`.

### P1 follow-ups

3. Remove hardcoded defaults in `OfferDocumentInputMapper::map_from_offer_dto()` (`floorArea=100`, etc.).
4. Indoor/outdoor unit names from `pumpSelection` / snapshot instead of catalog fallbacks.

### Key files

| Repo | Path |
|------|------|
| top-instal-generator | `core/application/OfferDocumentInputMapper.php` |
| top-instal-generator | `wp-adapter/services/PlaceholderBuilderService.php` |
| top-instal-generator | `core/application/harness/from-offer-dto-machine-room.regression.php` |
| kalk-top | `kalkulator/js/downloadPDF.js` (`buildOfferDocumentContext`) |
| kalk-top | `heatpump-calculator.php` (`ajax_generate_offer_document`) |
| kalk-top | `wp-adapter/mail-ingress/OfferDocumentsGeneratorClient.php` |

### Do not confuse

- **Energy report PDF** — `kalk-top/kalkulator/js/pdfGenerator.js` (already has OZC/costs)
- **Commercial offer PDF** — `top-instal-generator` via `from-offer-dto` mode

---

## Architecture — P0-2 floor_area semantics

**Status:** Open (model alignment, not form bypass).

`computeGeometry()` subtracts `wall_size` from footprint. Owner model: `floor_area` input is brutto. Form path `regular_method=area` uses square heuristic when length/width absent — intentional.

See `BACKLOG_RESOLUTIONS_2026-06-04.md` §4.

---

## Resolved this session (removed from open list)

- Steep attic without Poddasze — **fixed**
- Annual HDD inflation (partial) — **utilizationFactor 0.72**
- Form “empty bubble” to engine — **not reachable** in normal UI (documented)
- Pump gaps, catalog sync, ozcResult bypass — **owner: not backlog**

## Usage rule

Add entries when blocked. Remove or move to `decisions.md` / `BACKLOG_RESOLUTIONS` when resolved.

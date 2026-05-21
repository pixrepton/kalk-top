# References — kalk-top / OfferDTO

## Responsibility map

| Layer                 | Owns                                                 | Must not own                    |
| --------------------- | ---------------------------------------------------- | ------------------------------- |
| **kalk-top**          | Calculation, selection, pricing path to **OfferDTO** | Gmail intake, case memory       |
| **Configurator / FE** | UX, input collection, display                        | Canonical price truth           |
| **Generator**         | DOCX/PDF **rendering** of approved payload           | HVAC math, pricebook            |
| **Daszek**            | Projections, operator surface                        | Offer logic / canonical pricing |

## Files often involved (when present)

- `CalculateOfferUseCase.php` — orchestration of calculation → offer.
- `OfferDocumentsGeneratorClient.php` — seam to generator; watch payload shape.
- `WorkflowConfig.php` — wiring and flags; avoid sneaking logic here.
- `offerPayload.js`, `uiSummary.js` — FE summaries; must track backend contract.

## Checklist — “did logic leak to renderer?”

- [ ] Pricing computed in one canonical place
- [ ] FE mirrors backend but does not silently diverge
- [ ] Generator receives a **stable** DTO/payload contract
- [ ] PDF/DOCX excludes internal economics / trace payloads
- [ ] Field additions are documented for adapter ↔ Node B ↔ generator seams

## Related constitution docs

- `docs/core/CONSTITUTION_V2_1.md`, `AGENTS.md` — ownership boundaries

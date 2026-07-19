# PDF widoczne dla klienta — cross-repo

Kanoniczna tabela: [`top-instal-generator/docs/PDF_PATHS_CUSTOMER_FACING.md`](../../../top-instal-generator/docs/PDF_PATHS_CUSTOMER_FACING.md).

**Ten repo (`kalk-top`)** odpowiada za:

- **Energy/OZC PDF** — `kalkulator/js/pdfGenerator.js` (parametry techniczne, nie pełna oferta handlowa).
- **OfferDTO producer** — jedyne źródło liczb dla oferty handlowej; PDF oferty generuje `top-instal-generator` przez REST/mail-ingress.

Problem 7 (mapowanie OfferDTO → offer PDF) **CLOSED 2026-06-08** — patrz `offer-dto-pdf-mapping-audit.md`.

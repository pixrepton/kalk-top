# Ścieżki PDF — co widzi klient

**Status:** 2026-06-11 · **Proof:** `not proven` (docs only)

Operator zamknął Problem 7 (OfferDTO → offer PDF mapping) jako **by design** — ten dokument wyjaśnia **dwa niezależne** produkty PDF.

## Tabela ścieżek

| Ścieżka                  | Repo                                     | Trigger                                                 | Plik / endpoint                                         | Co pokazuje klientowi                                                                   |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Energy / OZC PDF**     | `kalk-top`                               | UI kalkulatora „Pobierz PDF”                            | `kalkulator/js/pdfGenerator.js`                         | Szacunki energii, OZC, parametry budynku — **nie** pełna oferta handlowa z ceną zestawu |
| **Commercial offer PDF** | `top-instal-generator`                   | REST `from-offer-dto` lub legacy AJAX `simple_generate` | `POST /wp-json/topinstal/v1/offer-documents/generate`   | Oferta handlowa DOCX/PDF z szablonu (zestaw, ceny, warunki)                             |
| **fast-kalk lead**       | `fast-kalk` → generator                  | Widget „Wyślij” (email)                                 | Ten sam REST `from-offer-dto` via kalk-top mail-ingress | PDF oferty na email operatora (bounded funnel)                                          |
| **cieplo.app**           | `cieplo-orchestrator` → kalk → generator | Mail Cieplo                                             | Orchestrator workflow                                   | Oferta po pipeline Cieplo (bez RAG)                                                     |

## Data flow (offer PDF)

```
kalk-top: CalculateOfferUseCase → OfferDTO
kalk-top: downloadPDF.js / mail-ingress → OfferDocumentsGeneratorClient
top-instal-generator: GenerateOfferDocumentUseCase → map_from_offer_dto() → DOCX/PDF
```

## Znane ograniczenia (nie bugi — operator 2026-06-08)

- `map_from_offer_dto()` ma hardcoded defaults (`floorArea=100`, itd.) — **nie planowane** do rozszerzenia.
- Legacy UI (`generator.js` → `simple_generate`) równolegle z REST — celowe.
- `machineRoomSnapshot` w kontekście nadpisuje część heurystyk (regression: `from-offer-dto-machine-room.regression.php`).

## Regresja

```powershell
php top-instal-generator/core/application/harness/from-offer-dto-machine-room.regression.php
```

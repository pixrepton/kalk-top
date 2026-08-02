# OFFER_DOCUMENT_MODULE_ARCHITECTURE.md

## 1) Stan przed
- `top-instal-generator.php` zawiera³ niemal ca³y pipeline generatora w jednym handlerze AJAX (`simple_generate`).
- Brak spójnego REST API dla agenta.
- Brak DTO i jednolitego kontraktu b³êdów.
- Konfiguracja PDF zawiera³a hardcoded defaults URL/token.

## 2) Stan po
Wdro¿ono architekturê zgodn¹ stylem z `kalk-top`:
- `core/contracts`:
  - `OfferDocumentRequestDTO.js`
  - `OfferDocumentResponseDTO.js`
  - `DocumentReasonCodes.php/js`
- `core/application`:
  - `GenerateOfferDocumentUseCase.php`
  - `OfferDocumentInputMapper.php`
  - `OfferDocumentException.php`
- `wp-adapter/rest`:
  - `GenerateOfferDocumentController.php`
  - `OfferDocumentRequestValidator.php`
  - `RestErrors.php`
- `wp-adapter/services`:
  - `GeneratorConfigWp.php`
  - `KitsRepositoryWp.php`
  - `TemplateSelectorService.php`
  - `PlaceholderBuilderService.php`
  - `DocxTemplateRendererService.php`
  - `PdfConverterClientWp.php`
  - `OfferFileStorageWp.php`
- `frontend/api`:
  - `topinstalDocumentsApi.js`

## 3) Flow requestu
1. Wejœcie: legacy AJAX (`simple_generate`) lub REST (`/offer-documents/generate`).
2. Adapter waliduje i normalizuje request DTO.
3. `GenerateOfferDocumentUseCase`:
   - mapuje wejœcie (`direct-config` / `from-offer-dto`),
   - dobiera kit i template,
   - buduje placeholdery,
   - renderuje DOCX,
   - opcjonalnie konwertuje do PDF,
   - zapisuje plik i buduje `OfferDocumentResponseDTO`.
4. OdpowiedŸ zawiera `traceId`, `document`, `meta`, `warnings`.

## 4) Auth i gate
- REST wspiera:
  - nonce (`X-Topinstal-Nonce`/`X-WP-Nonce`) dla UI,
  - API key (`X-Top-Instal-Agent-Key`) dla agenta.
- Rate limit na endpoint REST.
- Spójny error contract: `{ traceId, errorCode, message, details? }`.

## 5) Kompatybilnoœæ
- Legacy UI i `generator.js` pozostaj¹ aktywne.
- Legacy action `simple_generate` deleguje do nowego use-case.
- Legacy shape odpowiedzi (`filename`, `download_url`) jest zachowany.

## 6) Relacja generator <-> kalkulator
- Kalkulator (`kalk-top`) pozostaje wzorcem integracyjnym (REST+DTO+trace+error contract).
- Generator po refaktorze u¿ywa tego samego stylu warstw i kontraktów.
- Tryb `from-offer-dto` przygotowuje pe³n¹ œcie¿kê docelow¹:
  - kalkulator = source of truth obliczeñ,
  - generator = warstwa dokumentowa.

# DISCOVERY_REPORT.md

## Scope and date
- Scope: `top-instal-generator` refactor to modular architecture aligned with `kalk-top`.
- Date: 2026-03-06.
- Reference pattern: `kalk-top` (`core/contracts`, `core/application`, `wp-adapter/rest`, `traceId`, REST error contract).

## 1) Entrypoints and bootstrap
- Main plugin bootstrap: `top-instal-generator.php`.
- Frontend entrypoint:
  - shortcode `[top_instal_offer_generator]` renders form UI.
  - script `generator.js` posts to `admin-ajax.php`.
- Existing legacy AJAX actions:
  - `get_kits` (catalog filtering)
  - `simple_generate` (full generation in one function)
- New REST entrypoint added:
  - `POST /wp-json/topinstal/v1/offer-documents/generate`

## 2) Legacy flow (before refactor)
- `simple_generate` in `top-instal-generator.php` previously handled end-to-end in one block:
  - input parse/validation,
  - kits lookup,
  - template selection,
  - placeholder mapping,
  - DOCX generation,
  - DOCX->PDF conversion,
  - storage and response.
- PDF converter URL/token were hardcoded as defaults.
- Error responses were mostly free-form strings.

## 3) New modular flow (after refactor)
- Contracts:
  - `core/contracts/OfferDocumentRequestDTO.js`
  - `core/contracts/OfferDocumentResponseDTO.js`
  - `core/contracts/DocumentReasonCodes.php|js`
- Application:
  - `core/application/GenerateOfferDocumentUseCase.php`
  - `core/application/OfferDocumentInputMapper.php`
  - `core/application/OfferDocumentException.php`
- WP adapter:
  - REST: `wp-adapter/rest/GenerateOfferDocumentController.php`
  - Validation: `wp-adapter/rest/OfferDocumentRequestValidator.php`
  - Errors: `wp-adapter/rest/RestErrors.php`
  - Services: kits/template/placeholders/docx/pdf/storage/config
  - Logging + trace bootstrap
- Legacy compatibility:
  - old AJAX `simple_generate` and `get_kits` remain active,
  - now delegate to new controllers/use-case.

## 4) Current responsibilities by layer
- `core/*`
  - request normalization (`direct-config`, `from-offer-dto`),
  - orchestration and DTO output.
- `wp-adapter/services/*`
  - all WordPress/runtime IO and integrations (uploads, cURL converter, kits JSON access).
- `wp-adapter/rest/*`
  - auth gate (nonce or agent key), rate limiting, error contract, headers.
- `frontend/*`
  - existing UI unchanged (`generator.js`),
  - optional REST client available (`frontend/api/topinstalDocumentsApi.js`).

## 5) Security and config findings
- Hardcoded converter token/URL removed from code defaults.
- Runtime config now from WP options/env/constants via `TopInstal_Generator_Config_Wp`.
- New agent key option:
  - `top_instal_agent_api_key` (used by `X-Top-Instal-Agent-Key`).

## 6) Known constraints
- Legacy monolithic code still exists in `top-instal-generator.php` for rollback readability, but execution path is delegated early to modular controllers.
- No full WP runtime E2E in this workspace; validated by lint + harness.

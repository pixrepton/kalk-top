# DEPLOY_CHECKLIST_GENERATOR_API.md

## 1) Configuration
Ustaw w WP (Ustawienia -> Top-Instal Generator) lub przez env/constant:
- `top_instal_pdf_converter_url` / `TOP_INSTAL_PDF_CONVERTER_URL`
- `top_instal_pdf_converter_token` / `TOP_INSTAL_PDF_CONVERTER_TOKEN`
- `top_instal_agent_api_key` / `TOP_INSTAL_AGENT_API_KEY`

Opcjonalnie:
- `top_instal_pdf_debug_log` (diagnostyka konwertera)

## 2) Activation checks
1. Aktywuj plugin.
2. SprawdŸ shortcode UI (`[top_instal_offer_generator]`).
3. SprawdŸ czy istnieje katalog uploads: `wp-content/uploads/top-instal-offers`.

## 3) Smoke checks (manual)
1. Legacy UI:
- Wygeneruj ofertê z formularza.
- PotwierdŸ, ¿e dzia³a `filename + download_url`.

2. REST success:
- `POST /wp-json/topinstal/v1/offer-documents/generate`
- auth przez nonce lub `X-Top-Instal-Agent-Key`.
- oczekuj `status=success` i `document.downloadUrl`.

3. REST validation error:
- wyœlij request bez `payload` w `direct-config`.
- oczekuj `400` + `errorCode=VALIDATION_ERROR`.

4. REST auth error:
- brak nonce i brak key -> `401 AUTH_REQUIRED`.
- b³êdny key -> `403 AGENT_KEY_INVALID`.

## 4) Command checks (local)
- `php -l top-instal-generator.php`
- `php validate-json.php`
- `php core/application/harness/generate-offer-document.smoke.php`

## 5) Rollback
Rollback bez cofania refaktoru:
1. Dla UI: nadal dzia³a legacy AJAX (`simple_generate`) przez delegacjê.
2. Dla integracji: przestañ u¿ywaæ REST endpointu i wróæ do starej œcie¿ki UI.
3. W razie problemów z PDF: ustaw `outputFormat=docx` albo wy³¹cz konwerter (puste URL/token), system zwróci DOCX fallback.

## 6) Post-deploy observability
- Monitoruj logi PHP z prefiksem `[topinstal-generator]`.
- W³¹cz `top_instal_pdf_debug_log` gdy konwerter PDF zwraca b³êdy.

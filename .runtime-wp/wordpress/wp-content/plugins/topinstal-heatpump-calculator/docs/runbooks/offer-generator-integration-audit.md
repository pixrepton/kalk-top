# Offer Generator Integration Audit

Date: 2026-03-29

## Scope

This audit covers the kalk-top flow for step-10 offer PDF generation:

1. calculator/configurator click
2. WordPress AJAX bridge
3. generator HTTP client
4. external generator REST response validation

## Flow Trace

### Front click flow

- Step-10 button markup: `kalkulator/calculator.php`
  - `data-action="download-offer-pdf"`
- Front handler: `kalkulator/js/downloadPDF.js`
  - `downloadGeneratedOfferPdf()`
  - calls `window.topinstalApi.generateOfferDocument(...)`
- Shared AJAX client:
  - `kalkulator/js/topinstalApi.js`
  - `frontend/api/topinstalApi.js`
  - POSTs `action=heatpump_generate_offer_document` to `admin-ajax.php`

### WordPress AJAX flow

- Bootstrap/action registration: `heatpump-calculator.php`
  - `wp_ajax_heatpump_generate_offer_document`
  - `wp_ajax_nopriv_heatpump_generate_offer_document`
- AJAX handler: `HeatPump_Calculator::ajax_generate_offer_document()`
  - validates nonce
  - parses JSON payload
  - extracts canonical `offerDto`
  - builds trace/context
  - calls `TopInstal_OfferDocumentsGeneratorClient::generate(...)`

### Generator HTTP client flow

- Loader: `wp-adapter/bootstrap/offer-documents.php`
- Config source of truth: `gmail-agent/wp-adapter/mail-ingress/WorkflowConfig.php`
- HTTP client: `gmail-agent/wp-adapter/mail-ingress/OfferDocumentsGeneratorClient.php`
  - resolves endpoint/key/timeout
  - builds request payload:
    - `schemaVersion`
    - `traceId`
    - `mode=from-offer-dto`
    - `documentType=offer_document`
    - `outputFormat=pdf`
    - `offerDto`
    - additive `context`
  - dispatches external HTTP unless endpoint matches the current WP instance exactly

### Response parsing

- External response parse + classification: `gmail-agent/wp-adapter/mail-ingress/OfferDocumentsGeneratorClient.php`
- AJAX success/error envelope back to frontend: `heatpump-calculator.php`
- Frontend error extraction and throw path:
  - `kalkulator/js/topinstalApi.js`
  - `frontend/api/topinstalApi.js`

## Supported Configuration Sources

Endpoint resolution order after the fix:

1. `TOPINSTAL_MAIL_INGRESS_GENERATOR_ENDPOINT` / `topinstal_mail_ingress_generator_endpoint`
2. `TOPINSTAL_AGENT_OFFER_DOCUMENTS_ENDPOINT` / `topinstal_agent_offer_documents_endpoint`
3. `TOPINSTAL_MAIL_INGRESS_GENERATOR_BASE_URL` / `topinstal_mail_ingress_generator_base_url`
   - built to `/wp-json/topinstal/v1/offer-documents/generate`
4. repo default endpoint
   - `https://www.topinstal.com.pl/pdf/wp-json/topinstal/v1/offer-documents/generate`

Key resolution order after the fix:

1. `TOPINSTAL_MAIL_INGRESS_GENERATOR_KEY` / `topinstal_mail_ingress_generator_key`
2. `TOPINSTAL_AGENT_OFFER_DOCUMENTS_KEY` / `topinstal_agent_offer_documents_key`

Timeout:

- `TOPINSTAL_MAIL_INGRESS_GENERATOR_TIMEOUT` / `topinstal_mail_ingress_generator_timeout`

Developer/admin visibility:

- `TopInstal_MailIngressWorkflowConfig::get_generator_debug_summary()`
- shown on `Tools -> TOPINSTAL Smoke`
- reused by `TopInstal_Agent_HealthcheckService`

## Final Request Builder

Final external request is built in:

- `gmail-agent/wp-adapter/mail-ingress/OfferDocumentsGeneratorClient.php`

Headers:

- `Content-Type: application/json`
- `Accept: application/json`
- `X-Top-Instal-Agent-Key: <secret>`
- `Authorization: Bearer <secret>` (additive legacy compatibility)

## Response Contract Expected By kalk-top

Success is accepted only when:

- HTTP status is 2xx
- JSON body parses successfully
- body `status === "success"`
- `document` exists
- `document.format === "pdf"`
- `document.downloadUrl` exists and is non-empty

Warnings are preserved and logged but do not block success.

## Parallel / Legacy Paths

- `kalkulator/js/downloadPDF.js` still loads `html2pdf`, but that path remains for the energy report, not for step-10 offer PDF.
- `kalkulator/js/emailSender.js` uses the same generator-backed offer-document flow for email attachments.
- The client class now lives canonically under `gmail-agent/wp-adapter/mail-ingress/`, while the outer-root `wp-adapter/mail-ingress/` path remains only as a compatibility wrapper for existing includes.
- Downstream generator repo still exposes legacy AJAX `simple_generate`, but kalk-top step-10 does not use that route.

## Problems Found Before Fix

1. Endpoint/key diagnostics were collapsed into one `GENERATOR_NOT_CONFIGURED` branch.
2. Endpoint fallback order and source tracking were implicit, not inspectable.
3. BASE_URL build logic was not centralized and had weak normalization semantics.
4. 2xx empty body, malformed JSON, invalid shape, non-PDF fallback, and missing `downloadUrl` were not cleanly distinguished.
5. Success validation did not enforce generator `status=success`.
6. Healthcheck/admin surfaces did not consistently reuse the same generator config resolution path.
7. Frontend error objects dropped structured `details`.

## Fix Summary

1. Added explicit `resolve_generator_endpoint()`, `resolve_generator_key()`, and timeout/debug summary in `WorkflowConfig`.
2. Hardened the generator client with:
   - URL normalization/validation
   - structured error codes and details
   - timeout vs transport vs upstream auth/not-found classification
   - strict success-response validation
   - structured logging with trace id and parse result
3. Added dev/admin visibility for resolved endpoint, key presence, timeout, and config source.
4. Added regression coverage for config resolution and response validation.
5. Added a repo-safe default endpoint fallback while keeping the generator key external-only.

## Bootstrap hardening (2026-04-14)

After the workspace split into `kalk-top` + `gmail-agent/`, the compatibility wrappers were further hardened:

- `wp-adapter/mail-ingress/WorkflowConfig.php`: now tries two candidate paths (`kalk-top/gmail-agent/...` and sibling `../gmail-agent/...`) before falling back to a complete inline class definition of `TopInstal_MailIngressWorkflowConfig`.
- `wp-adapter/mail-ingress/OfferDocumentsGeneratorClient.php`: same multi-path bootstrap and inline fallback for `TopInstal_OfferDocumentsGeneratorClient`.
- `heatpump-calculator.php` `ajax_generate_offer_document()`: added `TopInstal_Logger_Wp::error(...)` with diagnostic bootstrap context (`workflowBootstrap`, `clientBootstrap`, class availability) when the client is still unavailable after bootstrap.
- `scripts/probes/offer-doc-client-probe.php`: availability regression probe (`php scripts/probes/offer-doc-client-probe.php` must exit 0).

Root cause of the regression: wrappers assumed a single fixed path that was no longer valid after the workspace split.

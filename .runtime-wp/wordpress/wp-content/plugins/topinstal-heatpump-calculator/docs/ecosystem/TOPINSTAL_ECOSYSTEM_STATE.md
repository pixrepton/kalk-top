# TOP-INSTAL Ecosystem State (Living Document)

> Status: canonical
> Owner: TOP-INSTAL ecosystem governance
> Last verified against code/runtime: 2026-04-02 (documentation governance pass; cross-repo state not fully runtime-reverified in this repo)
> Source-of-truth level: L1
> Supersedes: none
> Related docs: `TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md`, `../SOURCE_OF_TRUTH_INDEX.md`, `../TOPINSTAL_CANONICAL_ENTITY_MODEL.md`, `../TOPINSTAL_EVENT_MODEL.md`

> Update protocol: see `TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md`.

---

## 1. Ownership matrix

| Area                                        | Owner                                             | Notes                                                                                                                                                                                                                                             |
| ------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CalcRequestDTO, OfferDTO, calculation logic | kalk-top                                          | Source of truth                                                                                                                                                                                                                                   |
| Document generation (DOCX/PDF)              | top-instal-generator                              | Downstream consumer of OfferDTO                                                                                                                                                                                                                   |
| Gmail polling, mail parsing, dispatch       | topinstal-mail-ingress                            | Thin ingress; **dispatch target is configurable** (see §3)                                                                                                                                                                                        |
| Knowledge base, retrieval, explainability   | rag-chat-asystent                                 | May interpret results, not calculate them                                                                                                                                                                                                         |
| Mail-ingress → backend after dispatch       | kalk-top **and/or** topinstal-cieplo-orchestrator | **Orchestrator (VPS):** fetch cieplo HTML → build CalcRequestDTO → kalk-top `calculate-offer` → generator `from-offer-dto` → review mail. **Direct kalk-top:** `POST .../mail-ingress/cieplo-app` (WordPress) when backend URL points at kalk-top |
| VPS automation for cieplo.app leads         | topinstal-cieplo-orchestrator                     | Owns **orchestration** only; does not redefine DTOs or calculation rules                                                                                                                                                                          |
| Chat agent with tools (LLM → REST)          | agent-zordon                                      | Calls kalk-top / generator / RAG; **orchestration only**, same boundaries as `AGENT_BUSINESS_TOOLS.md`                                                                                                                                            |
| Generator integration (browser / server)    | kalk-top                                          | Calls generator REST; generator does not own offer logic. Browser step-10 download/email also enters through kalk-top runtime                                                                                                                     |

---

## 2. Cross-repo contracts

### CalcRequestDTO

Producer: UI, mail-ingress workflow
Consumer: kalk-top

- `schemaVersion`
- `traceId`
- `lead`
- `building`
- `preferences`
- `context`
- geometry minimum for REST validation: positive `heated_area` or `floor_area` or `total_area`, or both `building_length` and `building_width`
- optional `ozcResult` remains an intentional contract path for trusted external OZC input

Defined in: `kalk-top/core/contracts/CalcRequestDTO.js`
JSON Schema: `kalk-top/docs/ecosystem/schemas/calc-request-dto.v1.json`

### OfferDTO

Producer: kalk-top
Consumer: top-instal-generator, RAG, UI

- `schemaVersion`
- `traceId`
- `engineering`
- `engineering.ozc.audit`
- `pricing`
- `pricing.source`
- `pricing.catalogVersion`
- `warnings`
- `assumptions`
- `engineMeta`

Defined in: `kalk-top/core/contracts/OfferDTO.js`
JSON Schema: `kalk-top/docs/ecosystem/schemas/offer-dto.v1.json`

### cieplo_app_lead_v1 envelope

Producer: topinstal-mail-ingress
Consumer: **backend URL configured in mail-ingress** — typically **topinstal-cieplo-orchestrator** (`POST /api/ingress/cieplo-app`) or **kalk-top** (`POST /wp-json/topinstal/v1/mail-ingress/cieplo-app`). Same envelope; validator reference implementation: kalk-top `CieploAppIngressRequestValidator.php`.

- `kernel_schema_version`
- `payload_type`
- `trace_id`
- `request_id`
- `source_module`
- `payload.message`
- `payload.parsed_email`

Defined in: `topinstal-mail-ingress/src/Application/PayloadMapper.php`
Validated by: runtime-specific validators in the active mail-ingress / backend owner; the historical kalk-top validator reference is no longer canonical in this workspace.
JSON Schema: `kalk-top/gmail-agent/docs/ecosystem/schemas/cieplo-app-lead-v1.v1.json`

### OfferDocumentRequestDTO

Producer: kalk-top, RAG adapter
Consumer: top-instal-generator

- `mode`
- `offerDto` or `payload.offerDto` or `payload.offer`
- `output_format`
- `documentType`
- `traceId`

Defined in: `top-instal-generator/core/application/OfferDocumentInputMapper.php`
JSON Schema: `kalk-top/docs/ecosystem/schemas/offer-document-request-dto.v1.json`

---

## 3. Integrations

| From                          | To                            | Endpoint / mechanism                                                                              | Auth                            |
| ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------- |
| topinstal-mail-ingress        | kalk-top                      | `POST /wp-json/topinstal/v1/mail-ingress/cieplo-app`                                              | `X-Top-Instal-Agent-Key`        |
| topinstal-mail-ingress        | topinstal-cieplo-orchestrator | `POST /api/ingress/cieplo-app` (base URL from `TOPINSTAL_MAIL_BACKEND_URL`)                       | `X-Top-Instal-Agent-Key`        |
| topinstal-cieplo-orchestrator | kalk-top                      | `POST /wp-json/topinstal/v1/calculate-offer` (builds CalcRequestDTO from fetched lead context)    | `X-Top-Instal-Agent-Key`        |
| topinstal-cieplo-orchestrator | top-instal-generator          | `POST /wp-json/topinstal/v1/offer-documents/generate` (`mode: from-offer-dto` for pricing parity) | `X-Top-Instal-Agent-Key`        |
| kalk-top                      | top-instal-generator          | `POST /wp-json/topinstal/v1/offer-documents/generate`                                             | `X-Top-Instal-Agent-Key`, nonce |
| agent-zordon                  | kalk-top                      | `calculate-offer` (tool wrapper)                                                                  | `X-Top-Instal-Agent-Key`        |
| agent-zordon                  | top-instal-generator          | `offer-documents/generate` (tool wrapper)                                                         | `X-Top-Instal-Agent-Key`        |
| agent-zordon                  | rag-chat-asystent             | RAG HTTP (`ask_rag` / chat) when configured                                                       | per RAG deployment              |
| RAG adapter                   | kalk-top                      | calculator API when enabled                                                                       | TBD                             |
| RAG adapter                   | top-instal-generator          | `POST /wp-json/topinstal/v1/offer-documents/generate`                                             | `X-Top-Instal-Agent-Key`        |

Current calculator runtime note:

- browser step-10 offer download and email attachment preparation now call kalk-top AJAX `heatpump_generate_offer_document`, which proxies canonical `OfferDTO` to the existing generator integration and returns generator-produced PDF metadata back to the UI

---

## 4. Trace / auth / retry semantics

- `trace_id`: propagated end-to-end; header `X-Topinstal-Trace-Id`
- `request_id`: per-request idempotency key where applicable
- `workflow_id`: identifies the mail-ingress workflow instance
- `lead_id`: generated by kalk-top for `wp_topinstal_leads`
- `document_id`: generated by top-instal-generator for `OfferDocumentResponseDTO`
- auth: `X-Top-Instal-Agent-Key` for server-to-server; nonce for UI
- browser auth nuance: authenticated UI calls may send both `X-Topinstal-Nonce` and `X-WP-Nonce`
- retry: mail-ingress uses retryable flags from backend; transport idempotency is keyed by `message_id`

---

## 5. Active risks

- from-offer-dto mapping in the generator path is still partially lossy; some fields may be inferred or defaulted downstream
- UI lead shapes and mail-ingress parsed-email shapes are still not fully unified at the semantic level
- backend-vs-canonical-JS behavior now depends on keeping parity harnesses green as engines continue to evolve
- two checkpoint stores still exist for workflow observability: mail-ingress SQLite and kalk-top workflow storage

---

## 6. Legacy seams still present

- `heatpump-calculator.php` remains a large monolithic bootstrap/admin/runtime entry file
- runtime configuration still accepts selected legacy aliases for backward compatibility
- top-instal-generator still exposes legacy AJAX alongside REST
- RAG-side adapters are still integration consumers rather than full production owners of the calculator/generator path

Notably closed on the kalk-top side:

- active frontend local calculator fallback is no longer part of runtime truth
- configurator no longer uses legacy local pricing snapshots as the official offer source
- offer payloads and PDF/document payload assembly now require canonical backend pricing instead of rebuilding totals from `configurator.pricing`
- active frontend offer consumers no longer depend on `lastCalculationResult` as a primary source of truth

---

## 7. Visual map & developer workspace

- **HTML diagram (browser):** `docs/ecosystem/ECOSYSTEM_MAP.html` — open locally for flowcharts; **contracts and tables in this file remain canonical**; the HTML is a visual companion.
- **Folder layout & Cursor:** `docs/ecosystem/WORKSPACE_GOVERNANCE.md` — proposed Desktop structure, multi-root workspace, archive policy.
- **Repos on disk:** treat **`kalk-top`**, **`top-instal-generator`**, **`topinstal-mail-ingress`**, **`topinstal-cieplo-orchestrator`**, **`RAG Chat Asystent`**, **`agent-zordon`** as the integration surface. Other folders (experiments, archives, duplicate trees) are not authoritative unless changes are merged into those repos.

---

_Last updated: 2026-04-14_

**Changes since 2026-03-30:**

- Offer PDF generator client bootstrap hardened: `wp-adapter/mail-ingress/WorkflowConfig.php` and `OfferDocumentsGeneratorClient.php` are now multi-path wrappers with in-repo class fallback; the AJAX handler `ajax_generate_offer_document` now logs diagnostic bootstrap context when the client is unavailable.
- AIO recommendation gating tightened: `SelectionEngine` now requires explicit `aio_model_large_cwu` pairing in catalog for 260 l AIO eligibility; for 400 l+ CWU demand AIO disappears completely.
- CWU engine (`TopInstal_CwuEngine`) now feeds AIO selection thresholds directly from `SelectionEngine`.

# Decisions

## 2026-06-04 - Steep attic correction requires explicit Poddasze

- Decision: attic volume/heated-area multipliers apply only when `building_roof === 'steep'` **and** `building_heated_floors` contains `building_floors + 1` (Poddasze checkbox). `oblique` never triggers attic correction.
- Why: heating last full floor under a steep roof without checking Poddasze inflated volume and heated area.
- Impact: `OzcEngine::resolveAtticHeatingContext()`; regression in `ozc-full-audit.regression.php`. See `BACKLOG_RESOLUTIONS_2026-06-04.md` §5.

## 2026-06-04 - Annual HDD estimate uses utilization factor 0.72

- Decision: `computeAnnualEnergy_kWh()` scales HDD gross estimate by `utilizationFactor=0.72` (internal gains / non-full-load allowance; explicitly non-certificate).
- Why: raw `H × HDD × 24` systematically overstated annual kWh and downstream heat-pump costs; owner accepted SCOP 4 unchanged and declined CO/CWU split fix.
- Impact: `OzcEngine.php` `DEFAULTS['annualEnergy']`; assumptions logged in OZC result. P0-4 remains partial (no balance-temperature model).

## 2026-06-04 - Building area semantics and form authority

- Decision: `floor_area` in the calculator is **brutto** (footprint including walls); netto after `wall_size`. Users do not enter `heated_area` — it is derived from `building_heated_floors[]` and roof/basement rules.
- Why: owner business model; audit P0-2 was misread as missing user field.
- Impact: document in `BACKLOG_RESOLUTIONS_2026-06-04.md` §2; form `rules.js` gates invalid payloads; `regular_method=area` remains valid with square heuristic in engine.

## 2026-06-04 - Backlog items removed (not bugs)

- Decision: do not track as backlog — (1) ~0.1 kW pump catalog gaps, (2) `catalog_items.jsonl` vs `equipment-catalog.json` sync, (3) `ozcResult` REST bypass, (4) P0-6 CO cost split when CWU=0, (5) static SCOP 4.
- Why: owner explicit product/engineering acceptance.
- Impact: `BACKLOG_RESOLUTIONS_2026-06-04.md` §7; agents must not re-open without owner request.

## 2026-06-04 - kalk-top local runtime default port 8091

- Decision: kalk-top WordPress runtime and Playwright proof use port **8091** (8090 reserved for Daszek Local).
- Why: port collision in multi-service desktop workspace.
- Impact: `scripts/configure-runtime-wp.php`, `scripts/start-runtime-wp.ps1`, `playwright.config.ts`, `KALK_TOP_AGENT_HARNESS.md`.

## 2026-06-04 - Problem 7: PDF mapping audited, implementation deferred

- Decision: complete field-level audit of `OfferDTO` → `top-instal-generator` commercial offer PDF; implement mapping in generator as next P0 track.
- Why: highest business priority after OZC fixes; lossy mapping (`floorArea=100` defaults, no OZC in offer PDF) documented.
- Impact: `offer-dto-pdf-mapping-audit.md`, `open-questions.md`; energy report PDF (`pdfGenerator.js`) remains separate path.

## 2026-04-14 - Panasonic catalog pipeline (JSON-first, profiled extraction)

- Decision: a repo-local JSON-first pipeline (`scripts/panasonic_catalog_extract_v2.py`) now generates all Panasonic product/price artifacts from source PDFs in `panasonic/`; the pipeline uses per-section profiles and coordinate-based price matching.
- Why: pass-1 generic extraction produced only 2 categories (out of 11 required) and 0 correct prices for tanks/buffers/accessories/ventilation/fan-coils; a profiled approach was necessary to get semantic correctness.
- Impact: `data/normalized/`, `memory/`, `knowledge/panasonic/`, `context/`, `reports/panasonic_*` are now regenerable from the pipeline; canonical golden test (`tests/fixtures/panasonic_catalog_golden_test.py`) must pass before treating the normalized layer as production-ready.

## 2026-04-14 - Offer PDF generator bootstrap: multi-path wrapper with in-repo fallback

- Decision: `wp-adapter/mail-ingress/WorkflowConfig.php` and `OfferDocumentsGeneratorClient.php` now try multiple candidate paths (`kalk-top/gmail-agent/...` and sibling `../gmail-agent/...`) and define both classes locally when neither external path is present.
- Why: after the workspace split into `kalk-top` + `gmail-agent/`, the wrappers searched only one incorrect path, causing `TopInstal_OfferDocumentsGeneratorClient` to be unavailable and the `ajax_generate_offer_document` AJAX handler to return 500 for all offer PDF requests.
- Impact: offer PDF download via "Pobierz ofertę PDF" now works regardless of whether the `gmail-agent/` tree is present at either candidate path. The AJAX handler logs diagnostic bootstrap context when the client is still unavailable.

## 2026-04-05 - Gmail Intake and Daszek ownership moved into `gmail-agent/`

- Decision: the Gmail/Groq intake runtime, Daszek, selected bridge code, and related runtime docs/artifacts now live canonically under `gmail-agent/`, while outer-root legacy paths in `kalk-top` remain only as thin wrappers or pointer stubs.
- Why: the Gmail-first runtime needed its own clear ownership and Cursor cockpit without weakening kalk-top as the HVAC decision layer.
- Impact: Gmail-agent work should now start in `gmail-agent/AGENTS.md`; outer-root wrapper edits should stay minimal and compatibility-focused.

## 2026-04-05 - Gmail Intake run controls, validation origins, and case-key provenance are first-class runtime contracts

- Decision: Gmail Intake V1 should expose explicit run stop controls (`timebox`, `max_failures`, `max_consecutive_failures`), track final output provenance (`raw_valid`, `normalized_valid`, `repaired_valid`, `guardrailed_review`, `invalid`) as artifact-level vocabulary, and carry `case_key_source` alongside projected `case_key` into preview/review/eval artifacts.
- Why: the runtime already had retries, cooldowns, normalization, repair, and Daszek projection, but the system still lacked a clean answer to three operator questions: why did the run stop, how did the final output become valid, and where did the projected case key come from. Those gaps made long runs less predictable and shadow artifacts less useful for calibration.
- Impact: `gmail_intake.py` now records runtime controls plus `stop_reason`/`stop_details`, `artifact_contracts.py` and `eval_shadow.py` now surface validation-origin metrics and richer review CSV columns, `dash_preview.py` now records `case_key` + `case_key_source` consistently in projection metadata, and the system prompt vocabulary is now rendered from code-owned policy constants instead of manually duplicated lists.

## 2026-04-03 - Gmail Intake prefers local refresh-token flow over static access tokens

- Decision: when `GOOGLE_CLIENT_ID` and `GOOGLE_REFRESH_TOKEN` are configured, Gmail Intake should refresh a fresh Google access token in memory before Gmail connector calls and prefer that token over any static `GOOGLE_ACCESS_TOKEN`; `GOOGLE_CLIENT_SECRET` is included when the chosen OAuth client uses one
- Why: the original access-token-only mode was operationally brittle because Google access tokens expire mid-run; the repo needed a small local fix that improves operator safety without introducing a new backend service, browser auth flow, or persisted token store
- Impact: `tools/gmail_audit/google_oauth.py` is now the local owner of refresh-token exchange, `groq_client.py` resolves Gmail connector auth through it, `doctor` / preflight report the active auth mode without exposing secrets, refresh requests stay on HTTPS token endpoints, and failed refresh attempts stop the run loudly instead of silently falling back to a potentially stale static token

## 2026-04-03 - Gmail Intake runtime vocabulary and local artifact contracts now live in code

- Decision: Gmail Intake V1 should treat runtime vocabulary and local artifact shapes as code-owned contracts, not prose-only guidance. `tools/gmail_audit/intake_policy.py` is now the canonical owner for action, review-flag, priority, status, threshold, and Daszek object-mapping vocabulary, while `tools/gmail_audit/artifact_contracts.py` is the canonical owner for run-manifest, summary, validation, review CSV, and eval artifact shapes.
- Why: the static hardening pass found that policy and artifact semantics had been smeared across runner code, evaluator code, preview mapping, and spec docs, which made drift likely even without changing the external integrations.
- Impact: docs and prompt files should mirror these code contracts rather than restating competing versions; future Gmail Intake changes should update the shared policy/contract modules first, then only adjust runtime/docs where necessary.

## 2026-04-03 - Gmail Intake V1 stays preview-by-default, live Daszek push is explicit opt-in

- Decision: Gmail Intake V1 runtime truth is now split explicitly into three modes: preview-by-default, shadow review as the baseline operating mode, and experimental live Daszek push only behind `--push-daszek` plus successful preflight/config checks
- Why: the code already exposed real local Daszek mutation, while several V1 docs still described preview-only behavior; the repo needed one unambiguous statement so operators do not mistake experimental live push for the default rollout contract
- Impact: `tools/gmail_audit/README.md`, V1 spec docs, and `Daszek/SCHEMA.md` must describe preview/shadow/live boundaries consistently; safe operation requires `doctor` before live push, and `ignore` must never create Daszek records

## 2026-04-03 - Schema copies stay reference-only unless verified against runtime truth

- Decision: static schema copies under `docs/ecosystem/schemas/*` are reference-only unless they are explicitly verified against runtime or owning-repo behavior
- Why: copied schema artifacts were the easiest way to reintroduce authority drift after the governance cleanup
- Impact: locally verified `kalk-top` request/offer schema artifacts were aligned to runtime `schemaVersion = "1.0"`, while copied generator-facing schema artifacts stay non-canonical in this repo

## 2026-04-03 - Workflow, review state, and future intake normalization belong outside `kalk-top`

- Decision: `Workflow` and `ReviewAction` system-of-record ownership belongs to a separate orchestration/runtime layer, not to `kalk-top`; a future intermediate intake schema before `CalcRequestDTO` is an accepted direction, but it also belongs outside this repo's canonical runtime boundary
- Why: `kalk-top` must remain the decision core, not absorb orchestration-state ownership or multi-channel intake normalization logic
- Impact: entity/event/AI OS docs should place workflow state, review persistence, and future intake normalization in a separate orchestration or agent runtime, while preserving `CalcRequestDTO -> OfferDTO` as the only canonical decision boundary for this repo

## 2026-04-03 - Broader agent runtime docs should live outside `kalk-top`

- Decision: broader future agent-runtime architecture and cross-project Cursor/process docs should ultimately live in a separate runtime/project repo; `kalk-top` keeps only repo-local execution rules and boundary-facing summaries
- Why: repo-local coding-agent guidance must stay tightly coupled to `kalk-top`, while future multi-project agent runtime design is a different concern
- Impact: `docs/agent/*` remains non-canonical and should gradually become a thin boundary-facing layer instead of the home for the broader agent operating model

## 2026-04-02 - Documentation governance now uses explicit class and authority layers

- Decision: documentation is now explicitly classified as canonical / operational / transitional / vision, with authority levels `L0` to `L4`
- Why: the repo needed a disciplined way to separate runtime truth, canonical interpretation, operational guidance, historical material, and future-state AI OS vision
- Impact: agents should route through `docs/SOURCE_OF_TRUTH_INDEX.md`, `docs/DOC_GOVERNANCE.md`, `docs/READ_PRIORITY_MATRIX.md`, and `docs/AGENT_EXECUTION_STANDARD.md`; `docs/agent/*` stays non-canonical unless explicitly promoted

## 2026-03-30 - Visible pricing is backend-only and pricebook metadata travels with OfferDTO

- Decision: all visible commercial money in configurator runtime, step 10, offer payloads, and PDF payload assembly must come only from backend `OfferDTO`
- Why: frontend fallback pricing and synthetic price ranges caused drift risk between configurator UI, final summary, and documents; one canonical backend authority is required for business correctness
- Impact: `konfigurator/configurator-unified.js` no longer ships embedded fallback retail pricing, `kalkulator/js/uiSummary.js` renders exact backend gross, `kalkulator/js/offerPayload.js` no longer rebuilds pricing from `configurator.pricing` for document/runtime outputs, and additive `OfferDTO.pricing.source` / `OfferDTO.pricing.catalogVersion` are now part of the canonical contract surface

## 2026-03-17 - Memory bank is mandatory

- Decision: add `memory-bank/*` as repo-local working memory
- Why: active context must not live in always-on rules or long docs
- Impact: agents must read memory bank before meaningful work and update it after meaningful work

## 2026-03-17 - Keep exactly three always-on rules

- Decision: keep `00-topinstal-ecosystem-constitution.mdc`, `10-repo-role.mdc`, and `20-execution-protocol.mdc`
- Why: signal-to-noise matters more than splitting execution guidance into many rules
- Impact: workspace safety, evidence, verification, and escalation live in `20-execution-protocol.mdc`

## 2026-03-17 - Category-based docs are canonical

- Decision: move canonical local guidance to `docs/architecture/*`, `docs/discovery/*`, `docs/contracts/*`, `docs/plans/*`, `docs/runbooks/*`, and `docs/tooling/*`
- Why: `docs/agent/*` is too broad semantically and does not scale cleanly
- Impact: `docs/agent/*` becomes transitional pointer-only content

## 2026-03-17 - First-wave skills only

- Decision: create exactly four repo skills in the first wave
- Why: skills must prove they reduce rediscovery and execution time
- Impact: second-wave skills stay deferred until usefulness is demonstrated

## 2026-03-17 - V3 adds subsystem-local agent context

- Decision: add nested `AGENTS.md` files for `core/domain`, `core/application`, `wp-adapter`, `kalkulator`, and `konfigurator`
- Why: root-only context is not precise enough for high-signal work inside different subsystems
- Impact: agent now receives local constraints without bloating always-on rules

## 2026-03-17 - V3 uses Browser and Debug as evidence tools

- Decision: route visible UI verification through Browser and hard runtime bugs through Debug Mode
- Why: evidence-first workflows outperform read-and-guess patching for this repo
- Impact: UI and runtime claims should be backed by browser, logs, network, or debug evidence

## 2026-03-17 - Architecture assistance is a first-class workflow

- Decision: add architecture review, change-surface, and decision artifacts under `docs/architecture/*`
- Why: this repo needs help not only with coding but with correct architectural decisions across layers and downstream repos
- Impact: multi-layer changes should route through architecture-review workflow before or around implementation

## 2026-03-18 - Payload field classification is canonical for form and engines

- Decision: `docs/contracts/payload-field-classification.md` is the source of truth for which building fields are ZAWSZE / LUB / OPCJONALNIE in the payload
- Why: form (buildJsonData), engines (OZC, MVP), and mail-ingress all need consistent understanding of payload shape; LUB rules (geometry, construction_type, CWU) and optional fields affect validation and fallbacks
- Impact: when changing form fields, buildJsonData, or engine input handling, consult payload-field-classification.md; keep it in sync with formDataProcessor.js

## 2026-03-18 - Full JS OZC is the canonical backend path

- Decision: `TopInstal_OzcEngine_Full` is now the default OZC engine in `CalculateOfferUseCase`; parity PHP is the rollback path behind `USE_FULL_OZC_ENGINE=false`
- Why: PHP parity and Full JS produced materially different design heat loss for the same payload, while JS runtime is the intended source-of-truth model already mirrored from calculator engine code
- Impact: backend offers now default to `php-full-1`; Full OZC runtime failures fall back to parity PHP before MVP; contract docs and regressions must treat Full JS as the primary OZC authority

## 2026-03-21 - PHP engines are the sole active runtime owners

- Decision: `OZC`, `Buffer`, `Selection`, and `Pricing` now run canonically in PHP on the backend-first path; JS engines are retained only as parity/reference assets
- Why: active runtime ownership must be unambiguous at the `CalcRequestDTO -> OfferDTO` boundary and must not depend on duplicated browser or Node logic
- Impact: default `calculate-offer` runtime no longer depends on Node for OZC, configurator backend mode renders canonical pump/hydraulics/pricing from backend `OfferDTO`. *(2026-06: `test:engine-parity` / `engine-parity.php` removed; verify via `test:contract` + `proof`.)*

## 2026-03-22 - Step-10 offer documents must come from top-instal-generator

- Decision: the offer PDF exposed in configurator step 10 is now owned by `top-instal-generator`, not by browser-side `html2pdf`
- Why: the final customer-facing offer must come from one canonical document renderer and stay aligned with backend `OfferDTO`, pricing authority, and downstream generator workflow
- Impact: calculator runtime now calls the offer-documents integration endpoint for both direct offer download and email attachment preparation; browser-side PDF generation remains only for the separate energy-report path

## 2026-03-28 - CWU becomes a first-class backend domain engine

- Decision: introduce `TopInstal_CwuEngine` as the backend owner for DHW demand semantics, tank recommendation, hot-water power, annual CWU energy, and CWU explainability
- Why: CWU logic was previously split across JS configurator rules, OZC helpers, use-case fallbacks, and pricing heuristics, creating drift risk and unclear ownership
- Impact: `CalculateOfferUseCase` now exposes additive `engineering.cwu`, pricing can reuse backend CWU recommendation semantics, and `engineering.ozc.hotWaterPower_kW` stays for backward compatibility

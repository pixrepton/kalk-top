# Source Of Truth Index

> Status: canonical
> Owner: TOP-INSTAL documentation governance
> Last verified against code/runtime: 2026-06-04 (OZC backlog resolutions, PDF mapping audit, runtime port 8091)
> Source-of-truth level: L1
> Supersedes: none
> Related docs: `docs/DOC_GOVERNANCE.md`, `docs/READ_PRIORITY_MATRIX.md`, `docs/contracts/API_CALCULATE_OFFER.md`, `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`

## 1. Purpose

This index states which files are authoritative for key topics, and which documents must not be treated as canonical even if they are useful.

If two documents disagree, use the authority chain listed here.

## 2. Core authority map

| Topic                             | Runtime/code authority                                                                                                | Canonical doc authority                                                                                        | Notes                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Repo mission and boundary         | `AGENTS.md`, `.cursor/rules/*`, runtime code paths                                                                    | `docs/architecture/repo-rules.md`                                                                              | `kalk-top` is the decision core                           |
| REST route and transport contract | `wp-adapter/rest/CalculateOfferController.php`, `wp-adapter/rest/RequestValidator.php`                                | `docs/contracts/API_CALCULATE_OFFER.md`                                                                        | runtime wins over prose                                   |
| `CalcRequestDTO` shape            | `core/contracts/CalcRequestDTO.js`, validator/runtime callers                                                         | `docs/contracts/dto-and-boundaries.md`, `docs/contracts/README_NOWE_WEJSCIA_CALCULATE_OFFER.md`                | use runtime truth for REST                                |
| `OfferDTO` shape                  | `core/contracts/OfferDTO.js`, `core/application/CalculateOfferUseCase.php`                                            | `docs/contracts/dto-and-boundaries.md`                                                                         | additive fields should be documented here first           |
| HTTP validation minimum           | `wp-adapter/rest/RequestValidator.php`                                                                                | `docs/contracts/README_NOWE_WEJSCIA_CALCULATE_OFFER.md`, `docs/contracts/agent-calculate-offer-instruction.md` | validator is L0 authority                                 |
| UI -> DTO mapping                 | `frontend/api/mapUiStateToCalcRequestDTO.js` and runtime copy                                                         | `docs/contracts/field-mapping.md`, `docs/contracts/payload-field-classification.md`                            | mapper + validator together define practical shape        |
| Building payload classification   | mapper + downstream consumers                                                                                         | `docs/contracts/payload-field-classification.md`                                                               | canonical for ZAWSZE/LUB/OPCJONALNIE interpretation       |
| Pricing truth                     | `core/infrastructure/master-data/equipment-catalog.json`, `core/domain/pricing/PricingEngine.php`, `OfferDTO.pricing` | `docs/architecture/repo-rules.md`, `docs/konfigurator/README_DANE_CENY_ZDJECIA_KONFIGURATORA_KALK_TOP.md`      | visible runtime pricing is backend-owned                  |
| Workflow state truth              | owning runtime/service code in each repo                                                                              | `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`                                                                  | cross-repo state is indexed there, not fully owned there  |
| Auth truth                        | controller/runtime code                                                                                               | `docs/contracts/API_CALCULATE_OFFER.md`, `docs/runbooks/REST_AUTH_AND_AGENT_KEY_VERIFICATION.md`               | controller wins if conflict exists                        |
| Generator integration             | kalk-top adapter code + generator endpoint implementation                                                             | `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`, `docs/runbooks/offer-generator-integration-audit.md`, `docs/architecture/offer-dto-pdf-mapping-audit.md` | generator remains downstream renderer; **Problem 7 implementation open** |
| OZC method audit + backlog status | `core/domain/ozc/OzcEngine.php`, harness `ozc-full-audit.regression.php`                                              | `docs/architecture/ozc-professional-method-audit.md`, `docs/architecture/BACKLOG_RESOLUTIONS_2026-06-04.md`    | Code sync table is current priority over 2026-05-20 narrative |
| Offer PDF field mapping           | `top-instal-generator/.../OfferDocumentInputMapper.php`, kalk-top `downloadPDF.js`                                    | `docs/architecture/offer-dto-pdf-mapping-audit.md`                                                               | Analysis canonical; implementation in generator repo        |
| Ecosystem ownership               | owning repos + integration reality                                                                                    | `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`                                                                  | authoritative cross-repo ownership map                    |
| Agent operating rules             | `AGENTS.md`, nested `AGENTS.md`, `.cursor/rules/*`                                                                    | `docs/AGENT_EXECUTION_STANDARD.md`, `docs/READ_PRIORITY_MATRIX.md`                                             | runtime/dev execution rules live here, not in vision docs |
| Future AI channel ideas           | none; future-state only                                                                                               | offloaded archive / `knowledge/rfc/`                                                                           | not runtime truth                                         |

## 3. Known authority mismatches

### 3.1 `schemaVersion` drift and schema-copy lag

Known mismatch:

- active `kalk-top` runtime and canonical contract docs use `schemaVersion = "1.0"`
- copied/static schema JSON artifacts may lag behind runtime if they are not reconciled promptly

Authority:

1. runtime validator and request/response behavior,
2. fixture and mapper behavior,
3. canonical contract docs,
4. static schema JSON files if they lag.

Therefore, for active integrations, treat runtime `"1.0"` as authoritative.

## 4. What is not canonical

These materials may be useful, but they are not canonical engineering truth by themselves.

| Path/group                                       | Why not canonical                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| offloaded `docs/archive/*`                       | historical only — `gmail-agent-offloaded-archive/kalk-top-docs-2026-05-30/docs/archive/`                    |
| `docs/agent/AGENT_TOPINSTAL_FULL_SPEC.md`        | future-state/narrative agent design, not current runtime authority                                            |
| `docs/agent/AGENT_HVAC_SKILLS_RESEARCH.md`       | research only                                                                                                 |
| `docs/agent/AI_INPUT_CHANNELS_FUTURE_OPTIONS.md` | future backlog of channels, not runtime truth                                                                 |
| `docs/agent/README.md`                           | operational index only; check per-file status markers                                                         |
| offloaded `docs/overview/*`                      | orientation layer, not authority layer                                                                        |
| `docs/ecosystem/schemas/*`                       | static schema copies and schema index; useful reference, not stronger than runtime or canonical contract docs |
| `memory-bank/*`                                  | operational working memory, not canonical architecture or contracts                                           |
| `.runtime-wp/*`                                  | runtime mirror/evidence only, not source repo for documentation ownership                                     |
| `backup-tekstowe/*`                              | snapshot/reference only                                                                                       |
| compressed artifacts like `docs/ecosystem.zip`   | non-governed artifact, not source of truth                                                                    |

## 5. Fast rules for conflicts

When in doubt:

1. runtime code beats prose,
2. owner repo beats consumer repo,
3. canonical contract doc beats handbook/overview/runbook summary,
4. current-state doc beats future-state vision doc,
5. source-of-truth index beats local assumptions.

## 5b. Panasonic catalog layer

| Topic                                                   | Runtime / artifact authority                                                | Canonical doc authority                                                                              | Notes                                                                                                           |
| ------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Panasonic extraction / normalized catalog               | `data/normalized/catalog_items.jsonl`, `data/normalized/pricing_index.json` | `tests/fixtures/panasonic_catalog_golden_records.json`, `schemas/panasonic_catalog_item.schema.json` | re-generate from PDF via `scripts/panasonic_catalog_extract_v2.py`; golden test is L1 authority for extraction correctness |
| Panasonic **runtime** pricing + pump cards              | `core/infrastructure/master-data/equipment-catalog.json`, `konfigurator/panasonic.json` | `docs/konfigurator/README_DANE_CENY_ZDJECIA_KONFIGURATORA_KALK_TOP.md`, `docs/architecture/repo-rules.md` | `catalog_items.jsonl` is **not** loaded at runtime — manual or scripted sync into `equipment-catalog.json` when prices change |
| Panasonic extraction pipeline                           | `scripts/panasonic_catalog_extract_v2.py`                                   | `docs/panasonic_catalog_update_workflow.md`                                                          | v1 script is reference only                                                                                     |
| Panasonic knowledge (families, generations, categories) | `data/normalized/`                                                          | `knowledge/panasonic/`                                                                               | derived from normalized; do not edit knowledge files directly                                                   |
| Panasonic context packets                               | `context/llm/panasonic_context_packets.jsonl`                               | `knowledge/panasonic/`, `docs/panasonic_catalog_update_workflow.md`                                  | regenerate after PDF update                                                                                     |

## 6. Reading shortcuts

If the task is about:

- REST or payloads -> start in `docs/contracts/*`
- repo ownership or layer boundaries -> start in `docs/architecture/*`
- cross-repo integrations -> start in `docs/ecosystem/*`
- how the agent should work -> start in `AGENTS.md` and `docs/AGENT_EXECUTION_STANDARD.md`
- future AI OS direction -> offloaded archive or `knowledge/rfc/`

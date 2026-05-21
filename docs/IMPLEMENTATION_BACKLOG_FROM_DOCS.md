# Implementation Backlog From Docs

> Status: operational
> Owner: TOP-INSTAL documentation governance
> Last verified against code/runtime: 2026-04-14 (added Panasonic pipeline and offer-PDF bootstrap as implemented items)
> Source-of-truth level: L2
> Supersedes: none
> Related docs: `docs/DOC_CONFLICTS_AND_GAPS.md`, `docs/TOPINSTAL_AI_OS_BLUEPRINT.md`, `docs/SOURCE_OF_TRUTH_INDEX.md`

## 1. Purpose

This backlog turns the current documentation state into a practical set of follow-up actions.

## 2. Already exists and should be preserved

| Item                                    | State                    | Notes                                                                                                                            |
| --------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Backend-first decision core             | implemented              | `kalk-top` remains the authoritative `CalcRequestDTO -> OfferDTO` core                                                           |
| Generator as downstream renderer        | implemented              | preserve this role separation                                                                                                    |
| Ecosystem ownership/state doc           | implemented              | still the canonical cross-repo index                                                                                             |
| Contract documentation set              | implemented              | needs governance and anti-duplication discipline, not replacement                                                                |
| Agent/memory-bank/rules operating layer | implemented              | needed, but required cleanup and clearer trust boundaries                                                                        |
| Offer PDF generator client bootstrap    | implemented (2026-04-14) | multi-path wrapper + in-repo fallback; offer PDF download functional                                                             |
| Panasonic catalog data pipeline         | implemented (2026-04-14) | `scripts/panasonic_catalog_extract_v2.py`; 237 records, 10 categories, golden test 41/41; usable as canonical product/price base |

## 3. Documentation cleanup only

| Item                                                                     | Priority | Expected impact                                | Owner confirmation needed |
| ------------------------------------------------------------------------ | -------- | ---------------------------------------------- | ------------------------- |
| Normalize metadata across remaining important canonical docs             | P1       | lowers ambiguity quickly                       | no                        |
| Keep indexes updated (`docs/README.md`, handbook, source-of-truth index) | P1       | improves onboarding speed                      | no                        |
| Keep `docs/agent/*` visibly marked as non-canonical/vision               | P1       | reduces false authority drift                  | no                        |
| Continue de-bloating memory-bank                                         | P1       | improves agent continuity and lowers read cost | no                        |
| Reduce duplicated contract prose where summaries can link instead        | P2       | lowers maintenance overhead                    | no                        |

## 4. Implementation work likely needed later

| Item                                                                                                                         | Priority | Expected impact                                                                                   | Owner confirmation needed |
| ---------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------- | ------------------------- |
| Keep copied generator-facing schema artifacts explicitly reference-only unless verified against owning-repo/runtime truth    | P1       | prevents schema-copy drift from becoming false authority                                          | no                        |
| Define a persistent cross-system workflow state model in the orchestration layer, not in `kalk-top`                          | P1       | enables reliable automation and review tracking without moving state truth into the decision core | no                        |
| Introduce explicit review/review-action persistence                                                                          | P2       | supports bounded autonomy and accountability                                                      | yes                       |
| Define a stable intermediate intake schema before `CalcRequestDTO` for future AI channels in the orchestration/runtime layer | P1       | enables multi-channel intake without vendor lock-in while preserving `kalk-top` boundary purity   | no                        |
| Standardize event persistence and IDs across ingress/orchestrator/agent flows                                                | P2       | improves observability and retry logic                                                            | yes                       |
| Unify communication event tracking across email/chat/voice/WhatsApp                                                          | P2       | supports company operating system evolution                                                       | yes                       |
| Downstream operating-system entities (`InstallationJob`, `ServiceCase`)                                                      | P4       | distant future extension into delivery/service; keep out of near-term `kalk-top` scope            | no                        |

## 5. Blocked by owner confirmation

These are strategically plausible, but should not be assumed as accepted implementation work:

| Item                                                                                                      | Why blocked                                               |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Choosing the first concrete production multi-channel intake stack/vendor path                             | requires budget/product sequencing                        |
| Implementing a dedicated `topinstal-agent` runtime repo and moving broader cross-project agent docs there | accepted direction, but still requires project scheduling |
| Expanding into installation/service operating entities                                                    | deliberately deferred to a later company phase            |

## 6. Suggested rollout order

### Wave 1 - documentation and control

1. keep new canonical docs maintained,
2. finish metadata normalization on remaining critical docs,
3. keep memory-bank condensed,
4. use the read matrix and source-of-truth index for all future agent tasks.

### Wave 2 - boundary cleanup

1. resolve schema/runtime mismatches,
2. make workflow and event semantics more explicit,
3. reduce duplicated contract explanations.

### Wave 3 - future operating model implementation

1. introduce intermediate intake schema,
2. add explicit workflow/review persistence,
3. extend orchestration around the existing decision core,
4. later integrate installation/service layers.

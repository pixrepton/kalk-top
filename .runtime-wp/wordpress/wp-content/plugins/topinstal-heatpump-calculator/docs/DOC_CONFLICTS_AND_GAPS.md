# Documentation Conflicts And Gaps

> Status: operational
> Owner: TOP-INSTAL documentation governance
> Last verified against code/runtime: 2026-04-14 (Panasonic pipeline additions, offer-PDF bootstrap hardening)
> Source-of-truth level: L2
> Supersedes: none
> Related docs: `docs/DOC_INVENTORY_AND_CLASSIFICATION.md`, `docs/SOURCE_OF_TRUTH_INDEX.md`, `docs/DOC_GOVERNANCE.md`

## 1. Purpose

This document lists the major documentation conflicts, duplication patterns, ambiguity sources, and missing docs found during the documentation restructuring pass.

## 2. Confirmed conflicts

### 2.1 Static schema artifacts can still lag runtime truth

Conflict:

- static schema files are easy to treat as stronger than they really are
- copied schema artifacts may drift if they are not reconciled with owning-repo runtime behavior
- local `kalk-top` request/offer schema copies were aligned in this pass, but copied generator-facing artifacts still need explicit cross-repo verification

Authority:

- runtime and validator code are authoritative for integrations.

Impact:

- medium drift risk for integrators and AI tooling if they trust stale schema JSON blindly.

### 2.2 Contract truth duplicated across multiple prose docs

Observed overlap:

- `docs/contracts/API_CALCULATE_OFFER.md`
- `docs/contracts/agent-calculate-offer-instruction.md`
- `docs/contracts/README_NOWE_WEJSCIA_CALCULATE_OFFER.md`
- some runbooks and memory-bank notes

Risk:

- auth, rate limit, and minimum validation semantics can drift if all are edited independently.

### 2.3 Architecture described at multiple abstraction levels without a trust label

Observed overlap:

- `docs/README.md`
- `docs/HANDBOOK.md`
- `docs/overview/*`
- `docs/architecture/APPLICATION_WORKFLOW_AND_ENGINES_README.md`
- `docs/architecture/repo-rules.md`

Risk:

- a reader can mistake orientation docs for authority docs.

### 2.4 Agent docs mix narrative future state with execution guidance

Observed overlap:

- `docs/agent/AGENT_TOPINSTAL_FULL_SPEC.md`
- `docs/agent/AGENT_HVAC_SKILLS_RESEARCH.md`
- `docs/ecosystem/AGENT_BUSINESS_TOOLS.md`
- root `AGENTS.md`

Risk:

- future agent design and current coding-agent execution can be conflated.

### 2.5 Terminal rendering can still be mistaken for source corruption

Observed issue:

- PowerShell or terminal rendering may still display some Unicode awkwardly even after file-content cleanup.

Risk:

- reviewers may mistake terminal display issues for real file corruption,
- unnecessary re-edits can be introduced if raw file content is not checked first.

## 3. Outdated or transitional ambiguity

### 3.1 `docs/agent/*` needs file-level discipline, not folder-level assumptions

The folder index is now operational and points back to stronger authority docs, but individual files in `docs/agent/*` still need per-file trust markers and occasional cleanup.

### 3.2 `docs/overview/*` is valuable but not authoritative

The overview docs are helpful orientation material, but they are broad and easier to drift than focused canonical docs. They must stay visibly classified as orientation, not contract authority.

### 3.3 Archive material can still look alive if reached directly

`docs/archive/*` is already separated, but archive docs need continued discipline so they do not leak back into active read paths.

## 4. Memory-bank issues

### 4.1 `active-context.md` grew into semi-historical narrative

Problem:

- too much detailed milestone history,
- too many old task-specific notes,
- too much overlap with `progress.md`.

### 4.2 `progress.md` became a long chronology rather than a condensed operational summary

Problem:

- useful information exists,
- but retrieval cost is too high for a new session.

### 4.3 Memory-bank and canonical docs partially overlap

Examples:

- contract drift notes,
- architecture cleanup notes,
- integration notes that now belong in canonical docs.

## 5. Gaps found

Missing before this pass:

- no strict source-of-truth index,
- no documentation governance model,
- no canonical entity model,
- no canonical event model,
- no explicit agent execution standard,
- no practical read-priority matrix,
- no consolidated conflict/gap report,
- no durable implementation backlog derived from the docs corpus,
- no top-level AI OS blueprint connecting present system and future operating model.

### 5.1 Added after the audit

This pass closed several gaps:

- owner decisions on schema copies, orchestration ownership, and future runtime placement were recorded directly in canonical docs and `memory-bank/decisions.md`,
- overview and agent-index classifications were reconciled,
- schema-folder authority language was demoted from source-of-truth wording.

## 6. Mixed vision vs reality zones

These areas require explicit labeling:

- future AI OS and orchestration vision,
- future input channels and multimodal intake,
- agent full spec and market research,
- proposed workflow/review entities,
- future installation/service operating model.

These should remain visible, but not be mistaken for active runtime truth.

## 7. Encoding / presentation issues

Observed issue:

- file-content mojibake in high-badness docs was cleaned in this pass,
- terminal rendering should still be checked carefully before assuming a source file is broken.

Impact:

- lowers trust and readability,
- can create false-positive confusion during diff review.

## 9. 2026-04-14 pass — new artifacts outside previous scope

These areas were added during the 2026-04-14 work session and are not covered by older governance docs:

- Panasonic catalog pipeline (`panasonic/`, `data/`, `scripts/panasonic_catalog_extract_v2.py`, `memory/`, `knowledge/panasonic/`, `context/`, `schemas/panasonic_*.json`, `tests/fixtures/panasonic_*`) — added to `DOC_INVENTORY_AND_CLASSIFICATION.md` as the canonical index.
- Offer PDF generator bootstrap hardening — recorded in `memory-bank/decisions.md` and `docs/runbooks/offer-generator-integration-audit.md` (notes section).

No new governance conflicts found. Existing conflicts and follow-through items from §8 remain unchanged.

## 8. Required follow-through

High-priority follow-through items:

1. keep the new source-of-truth index up to date,
2. keep future-state docs marked as vision,
3. reduce duplication across contract docs by linking instead of restating,
4. keep memory-bank condensed,
5. keep copied schema artifacts aligned or clearly marked as reference-only,
6. verify raw file content before assuming terminal-rendered mojibake is still present,
7. record future resolved owner decisions directly in canonical docs and `memory-bank/decisions.md` instead of rebuilding a separate approval register.

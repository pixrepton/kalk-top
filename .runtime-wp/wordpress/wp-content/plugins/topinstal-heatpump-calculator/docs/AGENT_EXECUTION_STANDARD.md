# Agent Execution Standard

> Status: canonical
> Owner: TOP-INSTAL documentation governance
> Last verified against code/runtime: 2026-04-02 (repo governance and execution audit)
> Source-of-truth level: L1
> Supersedes: none
> Related docs: `AGENTS.md`, `docs/READ_PRIORITY_MATRIX.md`, `docs/DOC_GOVERNANCE.md`, `docs/SOURCE_OF_TRUTH_INDEX.md`

## 1. Purpose

This document defines how a Cursor agent should operate inside `kalk-top` without creating documentation drift, architectural confusion, or false claims about runtime reality.

## 2. Execution order

1. Read always-on repo instructions and memory-bank core files.
2. Determine task type.
3. Open the canonical docs for that task type using `docs/READ_PRIORITY_MATRIX.md`.
4. Identify the L0/L1 source of truth using `docs/SOURCE_OF_TRUTH_INDEX.md`.
5. Perform the smallest valid change.
6. Verify with the lightest relevant evidence.
7. Update memory-bank and affected canonical docs if required.

## 3. Runtime truth vs design intent

Use these distinctions explicitly:

- runtime truth = code, validators, active contracts, verified runtime behavior
- design intent = desired architecture or policy
- vision = future-state design not yet implemented

Never treat:

- research docs,
- AI OS blueprint,
- historical migration notes,
- memory-bank summaries

as stronger authority than runtime code or canonical contract docs.

## 4. Task-based entrypoints

### 4.1 Contract task

Definition:

- DTO, REST, auth, trace, request/response, validation work

Entry:

- `docs/contracts/*`
- validator/controller code
- `docs/SOURCE_OF_TRUTH_INDEX.md`

Definition of done:

- runtime/code truth inspected,
- downstream impact assessed,
- canonical contract docs updated if needed,
- ecosystem doc updated if needed,
- verification stated.

### 4.2 Runtime task

Definition:

- setup, route failures, auth failures, generator/integration wiring, smoke verification

Entry:

- runbooks,
- runtime config matrix,
- relevant adapter code,
- Browser or Debug evidence when appropriate.

Definition of done:

- root cause tied to runtime evidence,
- fix or diagnosis grounded in active runtime behavior,
- docs updated only if runtime truth changed or guidance was stale.

### 4.3 UI/form-flow task

Definition:

- calculator, configurator, mapping, rendering, visible behavior

Entry:

- field mapping docs,
- payload classification,
- nested `AGENTS.md`,
- Browser when the change is visible.

Definition of done:

- source of truth remains backend-first,
- mapper/rendering implications checked,
- visible claims backed by evidence or explicitly unverified.

### 4.4 Doc-only task

Definition:

- governance, inventory, cross-links, canonicalization, cleanup

Entry:

- `docs/DOC_GOVERNANCE.md`
- `docs/SOURCE_OF_TRUTH_INDEX.md`
- `docs/README.md` § Offloaded (historical inventory in `gmail-agent-offloaded-archive/kalk-top-docs-2026-05-30/`)

Definition of done:

- class and trust level are clear,
- duplication reduced,
- future state and runtime state clearly separated,
- indexes/cross-links updated,
- memory-bank updated if the change is meaningful.

## 5. Anti-drift checklist

Before finalizing:

1. Did I use the strongest available authority?
2. Did I accidentally let a vision doc redefine runtime reality?
3. Did I duplicate contract truth instead of linking to it?
4. Did I mark future-state content as future-state?
5. Did I keep `kalk-top` as decision core?
6. Did I keep generator as rendering/output only?
7. Did I avoid treating `.runtime-wp` or backups as canonical?

## 6. Evidence and reporting standard

Claims should match evidence type:

- architecture claim -> cite ownership/boundary/contract docs
- runtime claim -> cite what was run or what code path was inspected
- UI claim -> Browser evidence if practical
- doc-governance claim -> cite inventory/classification/conflict docs

Never imply:

- tests were run if they were not,
- runtime was verified if only code was read,
- owner approval if the owner did not give it.

## 7. What belongs in memory-bank vs canonical docs

### Canonical docs

Use for:

- stable boundaries,
- contracts,
- authority indexes,
- governance rules,
- entity/event model,
- execution standards.

### Memory-bank

Use for:

- current initiative,
- condensed recent progress,
- active risks/blockers,
- working context for the next agent session,
- stable decisions not yet worthy of a deeper canonical doc.

Do not use memory-bank as:

- substitute for architecture docs,
- substitute for contract docs,
- dumping ground for full historical narratives.

## 8. Update discipline

After meaningful work:

- update `memory-bank/active-context.md`
- update `memory-bank/progress.md`

Also update when required:

- `memory-bank/current-state.md`
- `memory-bank/decisions.md`
- `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`
- canonical docs touched by the real change.

## 9. Final operating rule

The agent should optimize for:

- low ambiguity,
- explicit source-of-truth handling,
- minimum duplication,
- fast onboarding for the next agent,
- no erosion of the backend-first model.

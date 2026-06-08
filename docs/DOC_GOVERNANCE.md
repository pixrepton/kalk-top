# Documentation Governance

> Status: canonical
> Owner: TOP-INSTAL documentation governance
> Last verified against code/runtime: 2026-04-02 (repo documentation audit)
> Source-of-truth level: L1
> Supersedes: none
> Related docs: `docs/SOURCE_OF_TRUTH_INDEX.md`, `docs/AGENT_EXECUTION_STANDARD.md`, `docs/READ_PRIORITY_MATRIX.md` (historical inventory: `gmail-agent-offloaded-archive/kalk-top-docs-2026-05-30/`)

## 1. Purpose

This document defines how the `kalk-top` documentation corpus is governed so that:

- canonical truth is easy to find,
- runtime truth is not confused with design intent,
- future-state vision is not confused with current runtime reality,
- agents know what to trust, what to update, and what not to treat as authority,
- documentation drift is contained.

This governance model reinforces the fixed architecture:

`kalk-top decision core -> adapters -> orchestration/supervision -> TOP-INSTAL operating system`

## 2. Documentation classes

### 2.1 Canonical

Use for documents that define or index stable truth needed to operate or change the system correctly.

Examples:

- repo role and boundary docs,
- contract docs,
- source-of-truth index,
- canonical entity and event model,
- agent execution standard,
- ecosystem ownership/integration state.

Rules:

- must stay aligned with code/runtime truth,
- should be concise and operational,
- may interpret code truth but must not override it,
- should include metadata.

### 2.2 Operational

Use for procedures, runbooks, inventories, action lists, and current working guidance.

Examples:

- runbooks,
- documentation inventory,
- conflict/gap report,
- implementation backlog,
- memory-bank files.

Rules:

- can be more task-oriented and time-bound,
- may summarize canonical material,
- must link back to canonical docs,
- should not redefine architecture or contracts.

### 2.3 Transitional

Use for materials kept temporarily because they still help migration, compatibility review, or historical interpretation.

Examples:

- migration notes,
- legacy compatibility checks,
- archive materials,
- superseded docs kept for reference.

Rules:

- must be clearly marked,
- must not be treated as current runtime authority,
- should either be archived or retired when no longer needed.

### 2.4 Vision

Use for future-state designs, AI OS blueprints, proposed channels, and operating-model direction.

Examples:

- AI OS blueprint,
- future input channel backlog,
- agent full future spec.

Rules:

- must explicitly distinguish existing vs partial vs proposed,
- must never be cited as runtime truth by itself,
- should reference canonical present-state boundaries rather than replace them.

## 3. Source-of-truth levels

Use these levels in metadata and classification work.

| Level | Meaning | Typical examples |
| --- | --- | --- |
| `L0` | Runtime/code truth | validators, controllers, DTO typedefs, contracts in code, active harnesses |
| `L1` | Canonical interpretation/index of L0 truth | contract docs, source-of-truth index, canonical entity/event docs |
| `L2` | Operational guidance derived from L0/L1 | runbooks, handbook, read matrix, implementation backlog |
| `L3` | Transitional/reference only | migration docs, archive, legacy compatibility notes |
| `L4` | Vision/proposed future state | AI OS blueprint, future input backlog, future agent operating model |

Rule:

- when L0 and L1 disagree, L0 wins until L1 is updated.
- when L1 and L2 disagree, L1 wins.
- L3 and L4 never override L0-L2.

## 4. Metadata standard

Important project docs should include a compact metadata block near the top.

Preferred fields:

- `Status`
- `Owner`
- `Last verified against code/runtime`
- `Source-of-truth level`
- `Supersedes`
- `Related docs`

Guidance:

- keep metadata short,
- use plain text, not heavy front matter machinery,
- do not add metadata to bundled third-party docs, licenses, vendor readmes, or trivial helpers.

## 5. What is authoritative

### 5.1 Runtime and contracts

Authority order:

1. code and active runtime behavior,
2. contract typedefs and validators,
3. canonical contract docs,
4. operational guides.

Examples:

- `RequestValidator.php` beats older prose if they disagree,
- runtime `schemaVersion` behavior beats stale schema JSON if drift exists.

### 5.2 Repo ownership and architecture

Authority order:

1. root `AGENTS.md` plus `.cursor/rules/*`,
2. canonical architecture docs,
3. handbook and overview docs,
4. narrative or vision docs.

### 5.3 Cross-repo ecosystem

Authority order:

1. code/runtime in owning repo,
2. `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`,
3. ecosystem design or narrative docs.

## 6. Update rules

### 6.1 Update required

Update canonical docs when:

- DTO shape changes,
- REST/auth/trace semantics change,
- ownership changes,
- new adapter/integration is added or removed,
- source of pricing truth or workflow truth changes,
- runtime authority changes between backend/frontend/adapters,
- a known conflict between docs and runtime is found.

### 6.2 Update recommended

Update operational docs when:

- verification workflow changes,
- new task routing pattern emerges,
- a common failure mode is discovered,
- the documentation inventory or read matrix becomes stale,
- backlog priorities change materially.

### 6.3 Update not required

Do not update canonical docs for:

- local refactors with no boundary change,
- formatting-only code changes,
- isolated bugfixes with no contract or ownership effect,
- private experimentation not adopted into repo reality.

## 7. Ownership model

| Doc class | Primary owner | Update executor |
| --- | --- | --- |
| Canonical | repo owner + responsible subsystem owner | owner or agent acting on owner instruction |
| Operational | repo operator / maintainer | owner or agent |
| Transitional | maintainer of migration/compat surface | owner or agent |
| Vision | owner / architecture lead | owner or agent, clearly marked as non-runtime |

Agents may draft and normalize docs, but owner approval remains final for architectural direction.

## 8. Superseded document handling

When a doc is superseded:

1. do not silently delete if it still has reference value,
2. move it to archive or mark as transitional,
3. add a short note pointing to the newer canonical doc,
4. remove it from primary read paths and indexes,
5. ensure it no longer appears to be runtime truth.

## 9. Drift prevention rules

### 9.1 One topic, one canonical home

Each critical topic should have one primary canonical home.

Examples:

- REST request/response truth: `docs/contracts/*`
- ecosystem ownership: `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`
- repo execution rules: `AGENTS.md` + `.cursor/rules/*`
- agent read order and definition of done: `docs/AGENT_EXECUTION_STANDARD.md`

### 9.2 Link instead of restating

If a document needs a rule owned elsewhere:

- summarize it briefly,
- link to the canonical document,
- do not restate the whole contract unless that document itself is the contract document.

### 9.3 Distinguish runtime truth from design intent

Use explicit wording:

- `runtime truth`
- `current state`
- `proposed`
- `future state`
- `reference only`

Avoid ambiguous phrasing like:

- `the system will`
- `the agent does`

unless that behavior already exists in code/runtime.

### 9.4 Keep memory-bank operational

Memory-bank should hold:

- current high-signal execution context,
- condensed progress,
- active blockers,
- stable decisions.

Memory-bank should not become a second long-form architecture corpus.

## 10. Review checklist for documentation changes

Before finalizing doc changes, ask:

1. Is the class of this doc explicit?
2. Is the authoritative upstream source clear?
3. Does this document redefine anything owned elsewhere?
4. If it references future state, is that labeled clearly?
5. If runtime truth changed, were canonical docs updated?
6. If only guidance changed, did we avoid pretending runtime changed?
7. Can a new Cursor agent determine what to trust after reading this?

## 11. Immediate governance decisions applied by this pass

- `kalk-top` remains the decision core and offer source of truth.
- `top-instal-generator` is documented as a rendering/output tool, not a decision core.
- future AI OS material is separated from current runtime truth.
- `docs/agent/*` remains narrative/vision space, not canonical engineering authority.
- memory-bank is treated as operational context, not canonical architecture documentation.

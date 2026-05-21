# TOPINSTAL Canonical Entity Model

> Status: canonical
> Owner: TOP-INSTAL architecture and documentation governance
> Last verified against code/runtime: 2026-04-03 (owner-direction reconciliation pass)
> Source-of-truth level: L1
> Supersedes: none
> Related docs: `docs/TOPINSTAL_EVENT_MODEL.md`, `docs/TOPINSTAL_AI_OS_BLUEPRINT.md`, `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`

## 1. Purpose

This document defines the shared business/system entity vocabulary across:

- `kalk-top`,
- `top-instal-generator`,
- `topinstal-mail-ingress`,
- current orchestration layers,
- the future TOP-INSTAL AI OS.

It does not claim that all entities already exist fully in code. Each entity is marked as:

- `existing`
- `partially existing`
- `proposed`

## 2. Entity table

| Entity | Purpose | Owner system | Key identifiers | Important relationships | Lifecycle notes | State |
| --- | --- | --- | --- | --- | --- | --- |
| `Lead` | Commercial intake record representing a prospect/opportunity | `kalk-top` and ingress/adapters around it | `lead_id`, `traceId`, external request IDs | linked to `Contact`, `Building`, `CalcRequest`, `Offer`, `CommunicationEvent` | may start from form, mail-ingress, chat, or future AI channel | partially existing |
| `Contact` | Person or organization contact facts | `kalk-top` request layer / future CRM | email, phone, contact name | belongs to `Lead`; may own multiple `CommunicationEvent` items | can exist before full technical data exists | partially existing |
| `Building` | Technical description of the heated object | `kalk-top` | geometry fields, building attributes, optional external identifiers | belongs to `CalcRequest`; informs `Offer` engineering | may begin sparse and be enriched over time | existing |
| `CalcRequest` | Canonical calculation snapshot sent to decision core | `kalk-top` | `traceId`, `schemaVersion`, request timestamp, source context | contains `Lead`, `Building`, `preferences`, optional `ozcResult`; produces `Offer` | immutable snapshot boundary preferred | existing |
| `Offer` | Canonical decision output from `kalk-top` | `kalk-top` | `traceId`, offer timestamp, optionally lead linkage | derived from `CalcRequest`; consumed by UI, generator, review workflow, and AI | authoritative offer truth for pricing and engineering | existing |
| `OfferDocument` | Rendered commercial document output derived from `Offer` | `top-instal-generator` | `document_id`, `traceId`, download URL, format | derived from `Offer`; referenced by `ReviewAction` and `CommunicationEvent` | may exist as DOCX or PDF; renderer-owned | existing |
| `Workflow` | Multi-step operational process spanning systems | separate orchestration/agent runtime layer | `workflow_id`, `traceId`, external message/request IDs | coordinates `Lead`, `CalcRequest`, `Offer`, `OfferDocument`, `ReviewAction` | should persist retry/final status outside `kalk-top` | partially existing |
| `ReviewAction` | Explicit human review or approval checkpoint | separate orchestration / business operations layer | `review_id`, `workflow_id`, actor, timestamp | attached to `Workflow`, `Offer`, `OfferDocument` | needed when autonomy is bounded by approval gates; not owned by `kalk-top` | proposed |
| `InstallationJob` | Accepted and scheduled installation work item | external ops/CRM/job layer | job ID, lead/offer linkage | follows accepted `Offer`; may create `ServiceCase` later | outside current repo runtime; useful for AI OS model | proposed |
| `ServiceCase` | Post-installation or support issue/service record | service/CRM layer | case ID, customer/site IDs | linked to `InstallationJob`, `CommunicationEvent`, `KnowledgeItem` | future operating-system entity | proposed |
| `KnowledgeItem` | Structured reusable explanation/knowledge artifact | RAG/knowledge layer | knowledge ID, source doc ID, version | supports `CommunicationEvent`, `ServiceCase`, `ReviewAction`, AI explanations | not decision truth; explanation/support truth | partially existing |
| `CommunicationEvent` | Any meaningful inbound or outbound communication | channel owner or orchestration layer | event ID, channel ID, `traceId`, timestamps | linked to `Lead`, `Workflow`, `ReviewAction`, `OfferDocument` | email/chat/voice/WhatsApp/web are all variants | partially existing |

## 3. Entity details

### 3.1 Lead

- Purpose: represent the commercial opportunity, regardless of source channel.
- Owner system: currently fragmented between ingress inputs and `kalk-top` persistence; long term should be coordinated by the operating layer, not by generator.
- Key identifiers:
  - `lead_id`
  - `traceId`
  - external message ID or conversation ID
- Lifecycle:
  - may begin with only contact data and sparse building facts,
  - can generate multiple `CalcRequest` snapshots,
  - should not be confused with a single request payload.

### 3.2 Contact

- Purpose: represent who is communicating.
- Important note: contact identity is not the same thing as the commercial lead or the building.
- Likely future need:
  - deduplication across multiple requests,
  - relationship to review and communication history.

### 3.3 Building

- Purpose: technical target of the calculation.
- Current strongest runtime representation already exists inside `CalcRequestDTO.building`.
- Notes:
  - can be incomplete at intake time,
  - may be enriched by quick forms, AI extraction, uploaded documents, or future orchestrators.

### 3.4 CalcRequest

- Purpose: the canonical request snapshot entering the decision core.
- Boundary rule:
  - this is the final normalized representation,
  - adapters may use richer intermediate structures, but `kalk-top` receives `CalcRequestDTO`,
  - any future intermediate intake schema belongs outside this repo's runtime boundary.

### 3.5 Offer

- Purpose: authoritative engineering and commercial decision output.
- Key rule:
  - this is the source of truth for downstream rendering,
  - generator must render from it, not reinterpret business logic.

### 3.6 OfferDocument

- Purpose: materialized presentation artifact of the offer.
- Owner rule:
  - renderer-owned by `top-instal-generator`,
  - not a business-decision authority.

### 3.7 Workflow

- Purpose: coordinate multi-step automation across systems.
- Current status:
  - parts exist in mail-ingress and orchestration flows,
  - a fully unified workflow model is not yet canonically implemented across the ecosystem,
  - accepted direction is that its system of record will live in a separate orchestration/runtime layer, not in `kalk-top`.

### 3.8 ReviewAction

- Purpose: explicit record that a human reviewed, approved, rejected, or requested correction.
- Why it matters:
  - future AI OS should not reduce all human control to ad hoc email threads.

### 3.9 InstallationJob

- Purpose: bridge from offer automation into operational delivery.
- State:
  - conceptually important for AI OS,
  - not owned by current `kalk-top` runtime.

### 3.10 ServiceCase

- Purpose: post-offer, post-installation operational/support entity.
- State:
  - future-facing and proposed in this corpus.

### 3.11 KnowledgeItem

- Purpose: explainability, FAQ, diagnosis, and procedural knowledge.
- Owner:
  - knowledge/RAG layer, not decision core.

### 3.12 CommunicationEvent

- Purpose: unify inbound and outbound communication into one language.
- Channel examples:
  - email,
  - chat,
  - voice call,
  - WhatsApp,
  - web form submission.

## 4. Relationship model

Core chain:

`Lead -> Contact`

`Lead -> Building`

`Lead -> CalcRequest -> Offer -> OfferDocument`

Operational layer:

`Lead -> Workflow -> ReviewAction -> CommunicationEvent`

Future company OS extension:

`Offer -> InstallationJob -> ServiceCase`

Support/explainability:

`KnowledgeItem -> ReviewAction / CommunicationEvent / ServiceCase`

## 5. Ownership rules implied by this model

- `kalk-top` owns `CalcRequest` and `Offer`.
- `top-instal-generator` owns `OfferDocument`.
- ingress and orchestration layers may create or route `Workflow` and `CommunicationEvent`, and future orchestration runtime should own `Workflow` / `ReviewAction`, but must not become the owner of calculation truth.
- future AI OS may coordinate entities, but must not replace `kalk-top` as the owner of decision output.

## 6. Design implications

- future adapters should map into `CalcRequest`, not invent competing offer entities.
- future multi-channel adapters may normalize through an intake-layer schema before `CalcRequest`, but that normalization layer should stay outside `kalk-top`.
- future AI systems should reason over `Lead`, `Workflow`, and `CommunicationEvent`, but call `kalk-top` for `Offer`.
- review and approval should become explicit entities rather than hidden implicit behavior.

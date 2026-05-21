# TOPINSTAL Event Model

> Status: canonical
> Owner: TOP-INSTAL architecture and documentation governance
> Last verified against code/runtime: 2026-04-03 (owner-direction reconciliation pass)
> Source-of-truth level: L1
> Supersedes: none
> Related docs: `docs/TOPINSTAL_CANONICAL_ENTITY_MODEL.md`, `docs/TOPINSTAL_AI_OS_BLUEPRINT.md`, `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`

## 1. Purpose

This document defines the event vocabulary across the decision core, adapters, and future operating layer.

It is not claiming that every event already exists as a persisted implementation. Each row should be read as:

- `existing`
- `partially existing`
- `proposed`

## 2. Event table

| Event name | Source | Emitted by | Payload summary | Downstream actions | Persistence requirement | Retryable | Final | Human review | State |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `lead.ingested` | form/mail/chat/voice/document channel | ingress/adapter | source channel, contact facts, raw payload reference, trace IDs | create/update `Lead`, open `Workflow` | yes | yes | no | no | partially existing |
| `calc.request.normalized` | adapter/orchestration layer | DTO normalizer in separate orchestration runtime | normalized request snapshot, source metadata, completeness flags | call `calculate-offer` | yes | yes | no | no | proposed |
| `calc.request.rejected` | decision core boundary | validator/controller | validation errors, trace ID, source context | ask for correction, retry with fixed payload | yes | yes | no | maybe | existing |
| `offer.calculated` | decision core | `kalk-top` | `OfferDTO`, warnings, assumptions, engine metadata | render UI, request document, trigger review | yes | no | yes for calc step | maybe | existing |
| `offer.calculation_failed` | decision core | `kalk-top` | error code, trace ID, context | retry, escalate, log defect | yes | yes depending on cause | yes for current attempt | maybe | existing |
| `offer.document.requested` | UI/agent/workflow | kalk-top adapter or orchestrator | `OfferDTO` reference, requested format, requester context | call generator | yes | yes | no | no | partially existing |
| `offer.document.generated` | rendering layer | `top-instal-generator` | `document_id`, format, URL, trace linkage | send to user, attach to review, archive | yes | no | yes for generation step | maybe | existing |
| `offer.document.failed` | rendering layer | generator or calling adapter | failure code, trace ID, request context | retry or escalate | yes | yes | yes for current attempt | maybe | existing |
| `review.requested` | workflow/orchestration | orchestrator or future AI OS runtime | target artifact, reason, priority, reviewer role | human review queue, notification | yes | yes | no | yes | proposed |
| `review.completed` | review layer | human reviewer / ops tool in orchestration layer | decision, comments, reviewer, timestamps | continue workflow, block, amend | yes | no | yes | yes | proposed |
| `communication.received` | channel layer | mail/chat/voice/WhatsApp/web intake | channel metadata, content reference, sender identity, trace linkage | parse, enrich lead, open or update workflow | yes | yes | no | maybe | partially existing |
| `communication.sent` | workflow/orchestrator | UI/backend/agent layer | channel, template, recipient, linked offer/doc | follow-up tracking, audit | yes | sometimes | yes for that send attempt | maybe | proposed |
| `workflow.state_changed` | orchestration layer | ingress/orchestrator/future AI OS | workflow ID, previous/new state, cause | dashboards, retries, review gates | yes | no | depends on state | maybe | proposed |
| `installation.job.created` | downstream ops layer | CRM / future AI OS | accepted offer, planned dates, assigned crew | operational delivery process | yes | yes | yes for job creation | yes | proposed |
| `service.case.opened` | downstream service layer | service platform / future AI OS | customer, site, issue summary, linked job/offer | support workflow, diagnostics, knowledge use | yes | yes | no | maybe | proposed |
| `knowledge.item.linked` | knowledge layer | RAG/orchestrator | knowledge ID, target event/entity, rationale | explainability, agent response support | optional | no | no | no | proposed |

## 3. Event interpretation rules

### 3.1 Decision-core events

Canonical decision-core events are those that describe:

- request validation,
- offer calculation,
- offer calculation failure.

These must stay anchored to `kalk-top`.

### 3.2 Rendering events

Document-generation events belong downstream.

They may be initiated by `kalk-top`, but the rendering result remains generator-owned.

### 3.3 Workflow events

Workflow and review events belong to orchestration/operating layers, not to the engineering core.

That means:

- `kalk-top` may participate in them,
- but should not be forced to become the system of record for every review or communication state,
- and the future system of record should live in a separate orchestration/runtime layer.

## 4. Current implementation notes

- `calc.request.rejected`, `offer.calculated`, and `offer.calculation_failed` already have strong runtime grounding in the current repo.
- `offer.document.requested` and `offer.document.generated` already exist in practice through the generator integration path.
- `lead.ingested` and `communication.received` exist partially across mail-ingress and intake paths, but not yet as one explicit event model.
- `review.*`, `workflow.state_changed`, `installation.job.created`, and `service.case.opened` are future operating-model events and should not be misread as already implemented system-of-record objects in `kalk-top`.
- any future intermediate intake-normalization eventing belongs before the `CalcRequestDTO` boundary and outside `kalk-top`.

## 5. Persistence rules

Use these rules when deciding whether an event must be recorded durably:

- persist if the event affects:
  - commercial correctness,
  - customer communication,
  - retryability,
  - review accountability,
  - downstream automation state.
- optional persistence is acceptable for:
  - explainability-only linkage,
  - transient UI telemetry,
  - local developer diagnostics.

## 6. Retry rules

Retry is usually valid for:

- intake/dispatch events,
- failed document generation caused by transport or dependency issues,
- normalization failures after data correction.

Retry is not usually valid without a new cause for:

- successfully completed calculation events,
- completed review decisions,
- immutable document IDs already issued.

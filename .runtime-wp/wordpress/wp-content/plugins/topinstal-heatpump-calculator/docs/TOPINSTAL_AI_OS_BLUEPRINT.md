# TOPINSTAL AI OS Blueprint

> Status: vision
> Owner: TOP-INSTAL architecture direction
> Last verified against code/runtime: 2026-04-03 (owner-direction reconciliation pass)
> Source-of-truth level: L4
> Supersedes: none
> Related docs: `docs/TOPINSTAL_CANONICAL_ENTITY_MODEL.md`, `docs/TOPINSTAL_EVENT_MODEL.md`, `docs/SOURCE_OF_TRUTH_INDEX.md`, `docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md`

## 1. Purpose

This blueprint describes the target operating model for the broader TOP-INSTAL AI OS while preserving current runtime truth:

- `kalk-top` is the canonical decision core,
- adapters sit around it,
- orchestration/supervision coordinates workflows,
- the company operating system emerges above workflows, review gates, documents, and memory.

This document is intentionally future-facing. It must not be read as proof that all described parts already exist.

## 2. Fixed truths this blueprint must preserve

1. `kalk-top` is the canonical decision core and source of truth for automatically created offers.
2. the offer is created automatically through `kalk-top` based on inputs.
3. `top-instal-generator` is a rendering/output tool.
4. generator is not the decision authority.
5. automation value is already accepted: faster response, faster offer generation, less dependence on owner presence.

## 3. North-star architecture

`decision core -> adapters -> orchestration/supervision -> firm operating system`

### 3.1 Decision core

Owner:

- `kalk-top`

Responsibilities:

- accept normalized `CalcRequestDTO`,
- calculate engineering and commercial outcome,
- return authoritative `OfferDTO`.

Must not be moved into:

- chat agent prompts,
- generator,
- WhatsApp bots,
- no-code flows,
- document extraction tools.

### 3.2 Adapters

Examples:

- website forms,
- quick forms,
- document ingestion,
- chat intake,
- voice intake,
- WhatsApp intake,
- mail-ingress,
- future CRM/import connectors.

Responsibilities:

- collect facts,
- extract structured data,
- enrich sparse input,
- optionally normalize first into an orchestration-layer intake model,
- then normalize into `CalcRequestDTO`,
- call the decision core.

### 3.3 Orchestration and supervision layer

Examples:

- `agent-zordon`,
- future TOP-INSTAL agent runtime,
- `topinstal-cieplo-orchestrator`,
- workflow supervisor,
- review routing.

Responsibilities:

- coordinate events and tasks,
- manage retries and review gates,
- own workflow and review state,
- own any future intermediate intake schema before `CalcRequestDTO`,
- call decision core and renderer,
- surface exceptions to humans.

Must not become:

- the owner of calculation logic,
- the owner of price truth,
- the owner of offer selection rules.

### 3.4 Firm operating system

The future company OS is the layer that coordinates:

- intake,
- calculation,
- review,
- document generation,
- communication,
- installation preparation,
- service follow-up,
- memory and analytics.

It is not a single model. It is the operating model built on:

- events,
- entities,
- workflows,
- approval gates,
- memory,
- KPIs.

## 4. Repo and system roles

| System / repo | Role in AI OS |
| --- | --- |
| `kalk-top` | decision core |
| `top-instal-generator` | document rendering adapter |
| `topinstal-mail-ingress` | intake adapter |
| `topinstal-cieplo-orchestrator` | workflow/orchestration adapter |
| `agent-zordon` or future agent runtime | orchestration and supervision, outside `kalk-top` |
| `rag-chat-asystent` | knowledge/explanation support |
| future CRM/ops/service tools | downstream business execution layers |

Direction:

- broader future agent-runtime docs and cross-project Cursor/process docs should live with that separate runtime/project, not inside `kalk-top`.

## 5. Main business entities

Core entity chain:

`Lead -> CalcRequest -> Offer -> OfferDocument`

Operational expansion:

`Workflow -> ReviewAction -> CommunicationEvent`

Future company-layer expansion:

`InstallationJob -> ServiceCase -> KnowledgeItem`

The detailed vocabulary lives in `docs/TOPINSTAL_CANONICAL_ENTITY_MODEL.md`.

## 6. Primary event flows

Accepted direction:

- `Workflow` and `ReviewAction` system-of-record ownership belongs to the orchestration/supervision layer, not to `kalk-top`.

### 6.1 Intake to offer

1. input arrives from form/chat/voice/document/ingress,
2. adapter extracts and normalizes facts,
3. `CalcRequestDTO` is built,
4. `kalk-top` returns `OfferDTO`,
5. result is shown or routed onward.

### 6.2 Offer to document

1. `OfferDTO` is available,
2. rendering is requested,
3. generator produces `OfferDocument`,
4. workflow continues with review or sending.

### 6.3 Review-driven flow

1. workflow flags human review,
2. reviewer accepts/rejects/asks for clarification,
3. approved offer/doc continues outward,
4. rejected path returns to intake correction or manual handling.

### 6.4 Future service flow

1. accepted offer creates downstream job,
2. installation/work completion emits service-capable records,
3. future support/service AI can use the same company entity model.

Detailed event vocabulary lives in `docs/TOPINSTAL_EVENT_MODEL.md`.

## 7. Review and approval checkpoints

The operating model should distinguish where autonomy is allowed and where approval is required.

### 7.1 No human review required

- normal calculation requests,
- document rendering requests,
- intake normalization,
- retry of clearly transient transport failures.

### 7.2 Human review recommended

- sparse or contradictory technical inputs,
- unusual pricing/output warnings,
- customer-facing outbound communication when confidence is low,
- cross-system recovery after repeated workflow failure.

### 7.3 Human review required

- legal/financial commitment beyond bounded automation policy,
- manual override of engineering/commercial result,
- final exceptions that cannot be normalized into standard flow.

## 8. Autonomy levels

| Level | Meaning | Example |
| --- | --- | --- |
| `A0` | manual only | human builds offer manually |
| `A1` | AI assist, human executes | AI pre-fills request or draft response |
| `A2` | bounded automation with human review gate | AI prepares offer/doc, human approves send |
| `A3` | bounded autonomous execution | AI normalizes input, runs calc, generates doc under clear policy |
| `A4` | autonomous supervision loop | future multi-step workflow handling with metrics and escalation |

Current safe target for most future TOP-INSTAL flows:

- `A2` to `A3`

Not recommended as assumed current reality:

- full `A4` across the company.

## 9. KPI layer

The AI OS should eventually track:

- lead response time,
- time from intake to `OfferDTO`,
- time from `OfferDTO` to `OfferDocument`,
- percent of cases resolved without owner presence,
- percent requiring human review,
- retry rate,
- document generation success rate,
- data completeness at intake,
- conversion from intake to reviewed offer,
- later: conversion from offer to installation,
- later: service resolution metrics.

## 10. Phased roadmap

### Phase 0 - current grounding

Already true:

- `kalk-top` is the decision core,
- generator is downstream renderer,
- ingress/adapters exist around the core,
- agent/orchestrator concepts exist but are not the decision truth.

### Phase 1 - low-drift documentation and control

- establish canonical entity model,
- establish event model,
- establish source-of-truth index,
- establish doc governance,
- reduce ambiguity for Cursor agents.

### Phase 2 - bounded operational AI

- quick forms and alternate intake channels normalize to `CalcRequestDTO`,
- document-first intake becomes structured,
- review gates become explicit,
- workflow IDs and event persistence become more uniform.

### Phase 3 - supervised multi-channel operations

- shared workflow layer across chat, voice, documents, ingress,
- explicit review and communication entities,
- KPI reporting by workflow/event.

### Phase 4 - company operating system

- coordinated lead, offer, document, review, installation, and service flows,
- memory and knowledge support at the operating level,
- bounded autonomy at business-process level while preserving `kalk-top` as decision authority.

## 11. Immediate design implications for this repo

- future AI OS material must stay clearly separated from current runtime docs,
- new channels must be documented as adapters around `kalk-top`,
- no future blueprint should blur generator into a decision engine,
- no future agent spec should redefine source-of-truth ownership away from `kalk-top`.

# Field Mapping

> Status: canonical
> Owner: TOP-INSTAL contract/form-flow owner
> Last verified against code/runtime: 2026-04-03 (metadata normalization pass)
> Source-of-truth level: L1
> Supersedes: none
> Related docs: `payload-field-classification.md`, `dto-and-boundaries.md`, `../../frontend/api/mapUiStateToCalcRequestDTO.js`, `../SOURCE_OF_TRUTH_INDEX.md`

## Canonical request shape

Map UI state and ingress payloads into `CalcRequestDTO`.

## Core fields

- `schemaVersion`: `1.0`
- `traceId`: generated or forwarded by caller
- `lead`: lead identity and contact data
- `building`: normalized building facts and selected form data
- `preferences`: heating, DHW, and configurator choices
- `context`: caller and runtime metadata

## Lead mapping

- `lead.name` <- `leadInput.name` or `formData.client_name`
- `lead.contact.email` <- `leadInput.email` or `formData.email`
- `lead.contact.phone` <- `leadInput.phone` or `formData.phone`
- `lead.contact.postalCode` <- `leadInput.postal_code`
- `lead.contact.preferredContactTime` <- `leadInput.preferred_contact_time`
- `lead.consents` <- `leadInput.consents`
- `lead.intent` <- `leadInput.intent`

## Building mapping

- `building` comes from `sourcePayload` when present, otherwise `buildJsonData()`
- Common source fields include `heated_area`, `include_hot_water`, `hot_water_persons`, `hot_water_usage`, `indoor_temperature`, `ventilation_type`

## Preferences mapping

- `preferences.heating.emitterType` <- `formData.heating_type` or `building.heating_type`
- `preferences.heating.sourceType` <- `formData.source_type` or `building.source_type`
- `preferences.heating.indoorTemperatureC` <- `building.indoor_temperature`
- `preferences.heating.ventilationType` <- `building.ventilation_type`
- `preferences.dhw.enabled` <- bool(`building.include_hot_water`)
- `preferences.dhw.persons` <- `building.hot_water_persons`
- `preferences.dhw.usageProfile` <- `building.hot_water_usage`
- `preferences.hasBuffer` <- `options.hasBuffer`, default `true`

## Configurator options

- `pumpOptionId` <- `configuratorSelections.pompa`
- `dhwOptionId` <- `configuratorSelections.cwu`
- `bufferOptionId` <- `configuratorSelections.bufor`
- `circulationOptionId` <- `configuratorSelections.cyrkulacja`
- `pressureReducerOptionId` <- `configuratorSelections.reduktor`
- `waterTreatmentOptionId` <- `configuratorSelections.woda`
- `foundationOptionId` <- `configuratorSelections.posadowienie`
- `serviceOptionId` <- `configuratorSelections.service`

## Mail-ingress bridge

- `traceId` <- `envelope.trace_id`
- `context.requestId` <- `envelope.request_id`
- `lead.email` <- `payload.parsed_email.client_email`
- `lead.phone` <- `payload.parsed_email.phone`
- `lead.city` <- `payload.parsed_email.location_raw`
- `lead.externalKey` <- external key or `sha256(email|cieplo_url)`
- `lead.externalUrl` <- `payload.parsed_email.cieplo_url`
- `building.heated_area` <- extracted fact or fallback policy
- `ozcResult.designHeatLoss_kW` <- extracted fact or fallback policy
- `ozcResult.recommendedPower_kW` <- extracted fact or fallback policy
- `preferences.dhw.persons` <- extracted fact or fallback policy
- `preferences.dhw.usageProfile` <- extracted fact or fallback policy
- `preferences.heating.emitterType` <- extracted heuristic or fallback policy

## Payload field classification

Szczegółowa klasyfikacja pól (ZAWSZE / LUB / OPCJONALNIE): `docs/contracts/payload-field-classification.md`

## Instrukcja dla agenta AI

Pełna instrukcja wywołania calculate-offer przez zewnętrznego agenta: `docs/contracts/agent-calculate-offer-instruction.md`

## Migration rule

- Backend remains the source of truth for engineering and pricing values
- Frontend `draftRequest` and `offer` are working state, not contract authority
- Fallbacks used during mail-ingress mapping must surface through assumptions, warning codes, or diagnostics

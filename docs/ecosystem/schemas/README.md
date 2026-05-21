# TOP-INSTAL Ecosystem - JSON Schemas

> Status: transitional
> Owner: TOP-INSTAL ecosystem governance
> Last verified against code/runtime: 2026-04-03 (authority reconciliation pass)
> Source-of-truth level: L3
> Supersedes: none
> Related docs: `../TOPINSTAL_ECOSYSTEM_STATE.md`, `../../SOURCE_OF_TRUTH_INDEX.md`, `../../DOC_GOVERNANCE.md`

Versioned JSON Schema artifacts for ecosystem DTO contracts.

These files are useful for:

- documentation,
- offline validation,
- integrator tooling,
- schema-aware code generation.

They are **not** stronger than runtime truth in the owning repository.

For `kalk-top`, authority order is:

1. active runtime behavior,
2. validator/controller/code contracts,
3. canonical contract docs,
4. static schema JSON files in this folder.

If a schema JSON file disagrees with runtime or canonical contract docs, treat the schema file as stale until it is reconciled.

## Conventions

- Format: JSON Schema draft-07
- Naming: `{contract-name}.v{version}.json`
- Versioning: bump file version on breaking changes, not on every editorial update
- Update protocol: if a cross-repo contract changes, also update `../TOPINSTAL_ECOSYSTEM_STATE.md`

## Files

| Schema | Description |
| --- | --- |
| `calc-request-dto.v1.json` | `CalcRequestDTO` reference schema for `kalk-top` |
| `offer-dto.v1.json` | `OfferDTO` reference schema for `kalk-top` |
| `cieplo-app-lead-v1.v1.json` | `cieplo_app_lead_v1` envelope reference schema (canonical copy now lives in `gmail-agent/docs/ecosystem/schemas/`) |
| `offer-document-request-dto.v1.json` | `OfferDocumentRequestDTO` reference schema |
| `offer-document-response-dto.v1.json` | `OfferDocumentResponseDTO` reference schema |

## Usage notes

- Use `opis/json-schema`, `ajv`, or equivalent tooling for offline validation.
- Keep these files aligned with the owning repo's runtime contracts.
- Do not cite this folder as the strongest authority when validators, controllers, or contract docs disagree.

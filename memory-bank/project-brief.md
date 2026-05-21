# Project Brief

## Purpose

`kalk-top` is the TOP-INSTAL decision layer. This repo owns HVAC calculation, selection, buffer, pricing, and offer generation.

## Canonical boundary

- Primary system boundary: `POST /wp-json/topinstal/v1/calculate-offer`
- Canonical transformation: `CalcRequestDTO -> OfferDTO`
- Repo root is canonical for edits
- `.runtime-wp/` is a runtime mirror, not a default edit target

## Core invariants

- `core/domain` stays pure: no WP, UI, DB, PDF, or mail concerns
- backend-first flow remains the source of truth
- contract changes require explicit downstream impact check
- rollback paths such as `USE_BACKEND_CALC` must not be silently broken

## Read rule

Read this file before meaningful work. Update only when repo mission or core invariants change.

# kalk-top GitNexus Guide

## Status

Dev-only static repo intelligence. Not runtime or REST proof.

## When to use

- Before refactors in `core/domain`, `core/application/CalculateOfferUseCase.php`, `wp-adapter/rest/`.
- To find call chains, importers, or blast radius for DTO/REST changes.
- When grep alone is ambiguous across PHP + JS boundaries.

## When not to use

- Claiming live WordPress behavior, auth, or production config.
- Replacing `npm run test:contract` or REST smoke.

## Procedure

1. Confirm index exists (`.gitnexus/` in repo root) or run `gitnexus analyze` from repo root.
2. Use GitNexus MCP `context` / `impact` on the symbol or file you will change.
3. Read confirming source files and nested `AGENTS.md`.
4. Run targeted harness: `npm run test:contract` for offer boundary edits.
5. Do not commit `.gitnexus/` cache to git unless project policy requires it.

## High-value entry points

| Area                         | Start file                                    |
| ---------------------------- | --------------------------------------------- |
| Offer orchestration          | `core/application/CalculateOfferUseCase.php`  |
| REST boundary                | `wp-adapter/rest/`                            |
| OZC / selection / pricing    | `core/domain/`                                |
| UI payload mapping           | `kalkulator/js/mapUiStateToCalcRequestDTO.js` |
| Configurator pricing display | `konfigurator/` + `konfigurator/AGENTS.md`    |

## Skill

`.agents/skills/gitnexus-static-repo-intel/SKILL.md`

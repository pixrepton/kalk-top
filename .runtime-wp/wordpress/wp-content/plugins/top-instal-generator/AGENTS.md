# Scope: top-instal-generator

**Rola:** Plugin WordPress generujący dokumenty ofertowe (DOCX/PDF) z OfferDTO; warstwa dokumentowa downstream od kalk-top.

**Wersja:** 1.0.0 · **Architektura:** `core/` (domena) + `wp-adapter/` (REST/AJAX/PDF)

## Granice

- Konsumuje `OfferDTO` — **nie** liczy HVAC (to `kalk-top`)
- Canonical API: `POST /wp-json/topinstal/v1/offer-documents/generate` (`mode: from-offer-dto`)
- Legacy UI: `generator.js` → AJAX `simple_generate`
- PDF: `PdfConverterClientWp` (remote converter lub LibreOffice lokalnie); domyślne URL/token **puste**

## Kluczowe pliki

- `core/application/GenerateOfferDocumentUseCase.php`
- `wp-adapter/rest/GenerateOfferDocumentController.php`
- `docs/API_GENERATE_OFFER_DOCUMENT.md`

Pełny router workspace: [../AGENTS.md](../AGENTS.md)

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **top-instal-generator** (644 symbols, 1137 relationships, 39 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/top-instal-generator/context` | Codebase overview, check index freshness |
| `gitnexus://repo/top-instal-generator/clusters` | All functional areas |
| `gitnexus://repo/top-instal-generator/processes` | All execution flows |
| `gitnexus://repo/top-instal-generator/process/{name}` | Step-by-step execution trace |

## Cross-Repo Groups

This repository is listed under GitNexus **group(s): topinstal-workspace** (see `~/.gitnexus/groups/`). For cross-repo analysis, use MCP tools `impact`, `query`, and `context` with `repo` set to `@<groupName>` or `@<groupName>/<memberPath>` (paths match keys in that group’s `group.yaml`). Use `group_list` / `group_sync` for membership and sync. From the terminal: `npx gitnexus group list`, `npx gitnexus group sync <name>`, `npx gitnexus group impact <name> --target <symbol> --repo <group-path>`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

# Change surface map — recovered checklist

Źródło: scalenie starego `gmail-agent-change-surface-map`. Użyj przed zmianą **wielowarstwową** (Python + Daszek + adapter); wpisuj do promptu lub notatek PR.

## First reads (gdy blast radius niejasny)

1. `AGENTS.md`
2. `docs/core/PHYSICAL_TOPOLOGY.md`
3. `docs/core/CONTEXT_PACK_SCOPE.md`
4. `memory-bank/current-state.md`, `memory-bank/active-context.md`
5. `docs/dev/AGENT_DEVELOPMENT_HARNESS.md`

## Invariants

- Wypisz **lokalne** punkty edycji.
- Wypisz **zależności zewnętrzne** (inne repo, środowisko).
- Wypisz **referencje tylko-archiwalne**.
- **Node A vs Node B** przed rekomendacją zmian pliku lub runtime.
- Nazwij **następny krok weryfikacji**.

## repo-graph MCP

`query` / `context` / `impact` / `detect_changes` — zobacz skill **`gitnexus-static-repo-intel`**. Potwierdź każdy punkt edycji odczytem pliku.

## Output format

```markdown
touched-local:
touched-external:
touched-archive:
contracts-and-boundaries:
review-before-build:
```

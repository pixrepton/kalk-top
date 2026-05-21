# GitNexus playbook — scalone ze `skille-odzysk/gitnexus/*`

## CLI (skrót)

| Komenda                       | Cel                                |
| ----------------------------- | ---------------------------------- |
| `npx gitnexus@latest analyze` | Budowa / odświeżenie grafu         |
| `npx gitnexus@latest status`  | Świeżość indeksu                   |
| `npx gitnexus@latest clean`   | Usunięcie `.gitnexus/` (ostrożnie) |

Flagi m.in.: `--force`, `--embeddings`, `--skip-git`, `--skip-agents-md` — patrz pełna dokumentacja narzędzia.

## Start (dowolny workflow)

1. `READ gitnexus://repo/{name}/context` — overview + **staleness**
2. Jeśli stale → `analyze`
3. Dobierz narzędzie MCP wg zadania (poniżej)

## Exploring („jak działa X?”)

```
gitnexus_query → gitnexus_context → READ process resource → read source files
```

Zasoby: `context`, `clusters`, `cluster/{name}`, `process/{name}`.

## Debugging („dlaczego fail?”)

```
gitnexus_query(symptom) → gitnexus_context(suspect) → process / cypher → read source
```

Wzorzec: symptom → podejrzany symbol → potwierdzenie w kodzie.

## Impact („co się zepsuje?”)

```
gitnexus_impact(target, upstream) → processes → detect_changes (pre-commit)
```

Głębokość d=1 bezpośrednie zależności — najwyższy priorytet testów.

## Refactoring (rename / extract)

```
impact → query → context → plan kolejności → rename dry_run → tests
```

`gitnexus_rename` — zawsze rozważ **dry_run** najpierw.

## Tools (MCP) — pamięć

| Tool             | Krótko                               |
| ---------------- | ------------------------------------ |
| `query`          | Przepływy związane z pojęciem        |
| `context`        | Widok symbolu 360°                   |
| `impact`         | Blast radius                         |
| `detect_changes` | Wpływ bieżącego diffu                |
| `cypher`         | Surowe zapytania — najpierw `schema` |

## Resources (URI)

`gitnexus://repo/{name}/context`, `/clusters`, `/schema`, `/processes`, … — lekkie odczyty nawigacyjne.

## Twarde przypomnienie

To wszystko jest **statyczne**. Runtime Gmail/Daszek/proof = osobna ścieżka (`gmail-agent-proof-run`, `release-gate-proof-pack`).

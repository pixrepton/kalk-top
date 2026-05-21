# gmail-agent Cursor coding harness — recovered playbook

Źródło: scalenie starego `gmail-agent-coding-harness`. **Nie** jest regułą always-on — ładuj ten plik tylko gdy pracujesz z MCP/hookami/slash commands w tym repo.

## Defaults

1. Topologia z `AGENTS.md`: **Node A** (WordPress/Daszek) vs **Node B** (Python/VPS). Nie traktuj uploadów Node A jako lokalnych plików Node B.
2. Język **evidence-first**: `confirmed locally` / `external reference` / `historical only`.
3. Przed „done” na zmianach kodu: zestaw z `/verify-pack` lub MCP `verify_local_baseline` + komendy powłoki.

## Reasoning i pamięć trwała

1. **Kontrastuj hipotezy** przy OAuth, hostname Postgres (`127.0.0.1` vs nazwa serwisu Docker), granicach Node A/B.
2. **Kotwicz** twierdzenia w ścieżkach repo lub uruchamialnych checkach.
3. **Pusty graf ≠ pusty repo** — GitNexus bez wyniku → grep + read; indeks może być zimny (`npx gitnexus@latest analyze`, ewent. `--skip-git --skip-agents-md`).
4. Po długiej sesji infra: krótki wpis do `memory-bank/agent-handover.md` ( fakty + wskaźniki, bez sekretów).

## MCP (projekt)

Serwer: **`gmail-agent-repo-assistant`** (`.cursor/mcp/repo-assistant-server.js`).

Wcześnie używaj:

- `memory_bank_slice`
- `verify_local_baseline`
- `gate_b_operator_checklist` / `release_gate_gate_b_excerpt`
- `doctor_json_summarize` — JSON pod ścieżkami operatora (np. `tools/gmail_audit/runs/`)
- Zasób `gmail-agent://gate-b-and-verify`

## Slash commands

Z `.cursor/commands/`: `/verify-pack`, `/doctor-local`, `/gate-b-orientation`, `/plan-handoff`.

## Hooks

`.cursor/hooks.json` — m.in. `shell-gate`, `after-file-edit-lint`, `stop` follow-up.

## Pełna mapa

`docs/archive/runbooks/CURSOR_AGENT_HARNESS.md`, `docs/dev/AGENT_DEVELOPMENT_HARNESS.md`. Rejestr skilli: `.agents/SKILL_ROUTER.md` (historyczny: `docs/archive/dev/AGENT_SKILLS_REGISTRY.md`).

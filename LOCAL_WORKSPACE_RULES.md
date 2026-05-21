# Local Workspace Rules

Status: active local workspace guardrail for Cursor, Codex, and coding agents in `kalk-top`.

## Local Truth

- This checkout is the canonical source for HVAC calculation, selection, pricing, and `OfferDTO`.
- Local files are not proof of live WordPress, production REST, mail-ingress, or generator runtime unless verified with runbooks and evidence.
- WordPress / runtime truth requires local runtime setup, REST smoke, or operator verification.

## Canonical Root

- Edit the **repo root** as canonical.
- Do **not** edit `.runtime-wp/` unless the user explicitly asks (runtime mirror/projection only).
- Gmail Intake, Daszek, and canonical mail-ingress bridge live under `gmail-agent/` in the multi-repo workspace.

## Git Use

- `git status`, `git diff`, and `git log` are OK for orientation when a `.git` directory exists.
- Do not propose, stage, commit, push, branch, merge, rebase, or deploy unless the user explicitly asks.
- Do not commit secrets, `.env`, or credentials.

## Context Hygiene

- Start from `AGENTS.md`, then `memory-bank/project-brief.md`, `memory-bank/current-state.md`, `memory-bank/active-context.md`.
- Use `.agents/SKILL_ROUTER.md` to select task-specific skills (max 1–3).
- For graph/impact questions: `docs/dev/KALK_TOP_GITNEXUS.md`, then GitNexus `context`/`impact`; verify in source.
- Do not scan all Markdown files by default.
- Do not treat `.runtime-wp/**`, `docs/archive/**`, `.gitnexus/**`, `test-results/**`, or `node_modules/**` as default context.
- Do not load `.env`, tokens, credentials, or raw customer data into chat.

## Documentation Placement

- `docs/contracts/`, `docs/architecture/` — canonical boundaries and API shape.
- `docs/ecosystem/` — cross-repo contracts (living document).
- `memory-bank/` — short active agent truth and handoff.
- `docs/dev/` — agent harness and dev tooling maps.
- `docs/archive/` — historical only unless explicitly requested.

## Tool Folders

- `.cursor/` — Cursor rules, commands, hooks, project MCP.
- `.codex/` — Codex CLI agents only.
- `.agents/skills/` — shared procedural skills for Cursor/Codex.
- `.gitnexus/` — index cache; regenerate on demand; not project truth.

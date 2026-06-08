# kalk-top Agent Development Harness

## Status

Active dev-tooling map for `kalk-top`. Not live WordPress or production REST proof.

## Purpose

Tell agents what to read first, what to load on demand, and how to verify without scanning the whole repo.

## What this is not

- Not a substitute for `docs/AGENT_EXECUTION_STANDARD.md` (normative L1).
- Not proof of live WP, mail-ingress, or generator runtime.
- Not permission to run full `npm run verify` on every small edit (too heavy).

## Active control plane

1. `AGENTS.md`
2. `LOCAL_WORKSPACE_RULES.md`
3. `memory-bank/project-brief.md`, `current-state.md`, `active-context.md`
4. `.agents/SKILL_ROUTER.md`
5. `.cursor/rules/00-kalk-top-core-router.mdc` (only always-on rule)
6. `docs/dev/KALK_TOP_AGENT_HARNESS.md` (this file)
7. Selected `.agents/skills/*/SKILL.md` (max 1–3)
8. Nearest nested `AGENTS.md`
9. Source + harness tests

## Session loop

1. Classify task (contract, UI, runtime, architecture, docs-only).
2. Open `SKILL_ROUTER` row.
3. Read only listed docs/skills.
4. Make smallest valid change.
5. Run lightest relevant verify command.
6. Update `memory-bank/active-context.md` and `progress.md` when meaningful.

## MCP

UI smoke przez workspace **playwright** (`top-code workspace/.cursor/mcp.json`, hosts `topinstal.com.pl`) — nie w `kalk-top/.cursor/mcp.json`.

| Server                    | Use                                                                         |
| ------------------------- | --------------------------------------------------------------------------- |
| `kalk-top-repo-assistant` | Contract surface, runtime preflight, route/auth, architecture review inputs |
| `playwright` (workspace)  | UI smoke on allowed hosts — workspace MCP, shared with gmail-agent          |
| Context7 (plugin)         | External library docs only                                                  |

Animation MCPs are **not** in `.cursor/mcp.json`. Use `npm run mcp:framer-motion` or `mcp:animation` when explicitly needed.

Treat MCP output as hints. Verify with file reads and npm harnesses.

## Verification commands

| Command                         | When                                                                      |
| ------------------------------- | ------------------------------------------------------------------------- |
| `npm run test:contract`         | DTO, engines, pricing, offer boundary                                     |
| `npm run test:fixtures`         | Fixture regressions                                                       |
| `npm run test:rest`             | REST e2e (requires `TOPINSTAL_REST_BASE_URL`)                             |
| `npm run verify:js`             | Calculator/konfigurator/frontend JS syntax                                |
| `npm run verify:js:regressions` | After UI/payload mapping changes                                          |
| `npm run proof`                 | `verify` + Playwright `@critical` + soft tier (runtime on **8091**)         |
| `npm run verify`                | Broad gate — only when user asks or release-style check                   |
| `npm run test:e2e`              | Playwright (`PLAYWRIGHT_BASE_URL`, default `http://127.0.0.1:8091`)       |

> `test:engine-parity` removed — use `test:contract` / `ozc-full-audit.regression.php` for OZC; see `ozc-professional-method-audit.md` § Code sync status.

Slash commands in `.cursor/commands/` wrap the same tiers.

## Multi-root workspace

When this repo is opened beside `gmail-agent/`:

- Files under `kalk-top/` load **kalk-top** rules and MCP.
- Gmail/Daszek/mail-ingress work → `gmail-agent/AGENTS.md`.

## Hooks

- `after-file-edit-lint` — `php -l` / `node --check` on canonical paths.
- `node scripts/agent-harness-preflight.mjs` after governance file edits (optional).

## Related

- `docs/AGENT_EXECUTION_STANDARD.md`
- `docs/READ_PRIORITY_MATRIX.md`
- `docs/dev/KALK_TOP_GITNEXUS.md`

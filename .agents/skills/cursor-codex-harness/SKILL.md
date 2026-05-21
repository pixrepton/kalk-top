---
name: cursor-codex-harness
description: Use when creating prompts for Cursor, Codex, Replit agents, implementation tasks, read orders, Definition of Done, anti-drift instructions, test commands, or evidence-first development harnesses.
---

# Cursor / Codex Harness

## Use When

- Writing implementation prompts, Cursor prompts, Codex task specs, or handoff prompts.
- Defining read order, Definition of Done, validation commands, or final report format.
- Auditing agent workflow and anti-drift instructions.

## Do Not Use When

- A domain skill already covers the execution and no prompt/workflow design is needed.

## Prompt Contract

Every serious implementation prompt should include:

- goal
- scope and non-goals
- read order
- likely files
- architecture constraints
- Definition of Done
- validation commands
- final evidence-first report format

## Anti-Patterns

- "Read/review everything" without a reason.
- Pasting full history or whole doc trees into context.
- Duplicating full skill bodies into Cursor rules.
- Claiming runtime proof from a prompt, plan, or MCP output.

## Minimal Procedure

1. Classify the task domain.
2. Pick 1-3 skills.
3. Write a prompt with scoped reads and stop conditions.
4. Attach commands that prove the change class.

## kalk-top read order (default)

1. `AGENTS.md`
2. `LOCAL_WORKSPACE_RULES.md`
3. `memory-bank/project-brief.md`, `current-state.md`, `active-context.md`
4. `.agents/SKILL_ROUTER.md`
5. `docs/dev/KALK_TOP_AGENT_HARNESS.md`
6. Nearest nested `AGENTS.md`

## kalk-top validation (by change class)

- Offer boundary: `npm run test:contract`, `npm run test:fixtures`
- REST (env): `TOPINSTAL_REST_BASE_URL=... npm run test:rest`
- UI JS: `npm run verify:js`
- Harness preflight: `node scripts/agent-harness-preflight.mjs`

For application changes, use the selected domain skill's tests.

---
name: context-budget-audit
description: Use when auditing Cursor rules, AGENTS.md, Agent Skills, token usage, context bloat, always-loaded instructions, alwaysApply flags, or progressive disclosure in TOP-INSTAL repositories.
---

# Context Budget Audit

## Use When

- Auditing always-on context, Cursor rules, `AGENTS.md`, skills, or docs routing.
- Deciding what is active, reference-only, or archive.
- Reducing duplicate core/proof instructions.

## Do Not Use When

- The task is a normal code change with no instruction/context changes.

## Rules

- Rules are routers; skills contain procedures.
- Keep `alwaysApply: true` rare and justified.
- Move long explanations to skill `references/`, not Cursor rules.
- Do not ask agents to read the whole repo by default.

## Checklist

1. Count `.cursor/rules/*.mdc` with `alwaysApply: true`.
2. Count lines in `AGENTS.md` and always-on rules.
3. Find duplicate Node A/B, Daszek, Gate, and `OfferDTO` guidance.
4. Mark large `SKILL.md` files over about 150-220 lines.
5. Classify docs as active / reference-only / archive.
6. Report top cuts and remaining risk.

## Report

- Always-on inventory.
- Bloat level: low / medium / high.
- Top 3 cuts.
- Files that must remain active.

## Context Discipline

Open this skill first, then inspect only the instruction files needed for the audit.

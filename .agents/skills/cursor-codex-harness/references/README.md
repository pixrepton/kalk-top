# References — Cursor/Codex harness

## Prompt template

```text
Goal:
Scope:
Non-goals:

Read order (why each):
1. ...

Likely files:
- ...

Constraints / boundaries:
- ...

Skills to open (.agents/skills/...):
- ...

Definition of Done:
- ...

Validation commands:
- ...

Report format:
- ...
```

## Definition of Done template

- Behavior change described precisely
- Tests updated/added or justified exemption
- Evidence attached (commands outputs)
- Risks + follow-ups

## Final report template

- What changed (files)
- Proof (commands)
- Not proven / external deps
- Risks

## Context minimization rules

- Prefer skills over mega-docs
- Prefer targeted reads over directory dumps
- Prefer links/paths over pasting large bodies

## Repo pointers

- `docs/archive/dev/AGENT_SKILLS_REGISTRY.md` (historyczny; kanon: `.agents/SKILL_ROUTER.md`) (if maintained)
- `docs/archive/agent-skills/README.md`

## Recovered playbooks (scalone — nie osobne skille)

- **Change surface / blast radius:** [`change-surface-map.md`](change-surface-map.md)
- **gmail-agent Cursor/MCP harness:** [`gmail-agent-coding-harness.md`](gmail-agent-coding-harness.md)

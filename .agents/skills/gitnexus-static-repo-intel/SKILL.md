---
name: gitnexus-static-repo-intel
description: Use when using GitNexus MCP or CLI for static repo intelligence, code exploration, impact analysis, debugging traces, refactoring blast radius, indexing, or graph queries in the kalk-top workspace.
---

# GitNexus Static Repo Intelligence

## Use When

- Navigating code paths, call chains, imports, or blast radius.
- Running GitNexus MCP queries or CLI indexing.
- Comparing static graph findings with source files.

## Do Not Use When

- Making live WordPress REST, production runtime, or mail-ingress claims by itself.

## Rules

- GitNexus is dev-only static repo intelligence.
- It is not runtime proof.
- It is not live WP runtime proof.
- Always verify important findings by source reads and tests.

## Minimal Procedure

1. Read `docs/dev/KALK_TOP_GITNEXUS.md` and nearest nested `AGENTS.md`.
2. Check indexed repositories and `indexedAt`.
3. If stale, run `gitnexus analyze` from repo root.
4. Use `query`/`context` for orientation and `impact` before changes.
5. Confirm conclusions in files before editing.
6. Do not commit `.gitnexus/`.

## Report

- Graph says.
- Source confirms.
- Still unknown.

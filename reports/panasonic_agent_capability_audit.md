# Panasonic Agent Capability Audit

## What was detected

- Workspace has agent governance: `AGENTS.md`, nested subsystem `AGENTS.md`, `.cursor/rules/*.mdc`, `.agents/skills/*`.
- Local MCP config exists in `.cursor/mcp.json` (Framer Motion + GSAP), but no PDF-specific MCP dependency is required.
- Python runtime available (`Python 3.12.2`) with `pdfplumber`, `pypdf`, `pandas`, `jsonschema`.
- Missing optional table tools: `camelot`, `tabula`.
- Source file is available in `panasonic/Panasonic_cennik_pompy_ciepla_03.2026.pdf`.

## What this implementation uses

- JSON-first extraction pipeline implemented repo-local in:
  - `scripts/panasonic_catalog_extract.py`
  - `scripts/panasonic_catalog_normalize.py`
  - `scripts/panasonic_catalog_validate.py`
  - `scripts/panasonic_catalog_compare.py`
- Schemas in `schemas/panasonic_*.schema.json`.
- Raw/normalized/memory/knowledge/context/report artifacts in required folders.
- Validation via `jsonschema` and deterministic consistency checks.

## What is not available / gaps

- No dedicated OCR stack in pipeline by default (conservative choice: text+table extraction first).
- No dedicated PDF table ML parser (`camelot/tabula`) installed; extraction relies on `pdfplumber` and fallback heuristics.
- No previous canonical Panasonic baseline in repo for true historical compare; generated baseline mode is provided.

## Assumptions

- Currency interpreted as PLN net where parseable.
- Effective date inferred from filename/content when explicit header is missing.
- If a field cannot be extracted reliably, it is left empty/null and uncertainty is recorded.

## Skills / operational docs placement

- Existing global skill system is preserved.
- Task-specific operational skill pack added in `panasonic/agent-skills/` for repeatable PDF-catalog work.

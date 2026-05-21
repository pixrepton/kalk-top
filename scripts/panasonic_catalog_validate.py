#!/usr/bin/env python3
"""Validation for Panasonic normalized artifacts."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import jsonschema


ROOT = Path(__file__).resolve().parents[1]


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_jsonl(path: Path):
    records = []
    if not path.exists():
        return records
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            records.append(json.loads(line))
    return records


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--schema", default="schemas/panasonic_catalog_item.schema.json")
    p.add_argument("--items", default="data/normalized/catalog_items.jsonl")
    args = p.parse_args()

    schema = load_json(ROOT / args.schema)
    items = load_jsonl(ROOT / args.items)
    validator = jsonschema.Draft202012Validator(schema)
    errors = []
    for i, item in enumerate(items):
        for e in validator.iter_errors(item):
            errors.append({"index": i, "path": list(e.path), "message": e.message})

    missing_page_source = [i for i, r in enumerate(items) if not r.get("page") or not r.get("source_doc")]
    missing_model_for_heat_pump = [i for i, r in enumerate(items) if r.get("category") == "heat_pumps" and not r.get("model")]

    out = {
        "validated_items": len(items),
        "schema_error_count": len(errors),
        "missing_page_or_source_count": len(missing_page_source),
        "missing_model_for_heat_pump_count": len(missing_model_for_heat_pump),
        "schema_errors": errors[:200],
    }
    (ROOT / "reports").mkdir(exist_ok=True)
    (ROOT / "reports" / "panasonic_schema_validation.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    summary_md = (
        "# Panasonic schema validation\n\n"
        f"- Validated items: {out['validated_items']}\n"
        f"- Schema errors: {out['schema_error_count']}\n"
        f"- Missing page/source: {out['missing_page_or_source_count']}\n"
        f"- Missing model for heat_pumps: {out['missing_model_for_heat_pump_count']}\n"
    )
    (ROOT / "reports" / "panasonic_schema_validation.md").write_text(summary_md, encoding="utf-8")


if __name__ == "__main__":
    main()

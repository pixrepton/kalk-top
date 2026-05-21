#!/usr/bin/env python3
"""Compare two Panasonic pricing/model snapshots."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--old", required=False, help="Old pricing_index.json")
    p.add_argument("--new", default="data/normalized/pricing_index.json")
    p.add_argument("--out", default="reports/panasonic_changes_vs_previous.md")
    args = p.parse_args()

    root = Path(__file__).resolve().parents[1]
    new = load_json(root / args.new)
    old = load_json(root / args.old) if args.old else {}

    new_models = set(new.keys())
    old_models = set(old.keys())
    added = sorted(new_models - old_models)
    removed = sorted(old_models - new_models)
    changed = []
    for m in sorted(new_models & old_models):
        new_price = (new.get(m) or {}).get("price_net")
        old_price = (old.get(m) or {}).get("price_net")
        if new_price != old_price:
            changed.append((m, old_price, new_price))

    md = [
        "# Panasonic changes vs previous",
        "",
        f"- Baseline mode: {'yes' if not args.old else 'no'}",
        f"- Added models: {len(added)}",
        f"- Removed models: {len(removed)}",
        f"- Price changed models: {len(changed)}",
        "",
        "## Added",
    ]
    md.extend([f"- `{m}`" for m in added[:200]] or ["- none"])
    md.append("")
    md.append("## Removed")
    md.extend([f"- `{m}`" for m in removed[:200]] or ["- none"])
    md.append("")
    md.append("## Price Changes")
    md.extend([f"- `{m}`: {o} -> {n}" for m, o, n in changed[:300]] or ["- none"])

    out = root / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(md) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

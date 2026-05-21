#!/usr/bin/env python3
"""Golden test: validate extracted catalog against golden records.

Checks:
- All golden models present in catalog_items.jsonl
- Category matches
- Subcategory present (non-empty)
- Price within tolerance of golden value
- Page matches exactly
- source_doc and page always present
- No heat_pumps record with empty model
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ITEMS_FILE = ROOT / "data/normalized/catalog_items.jsonl"
GOLDEN_FILE = ROOT / "tests/fixtures/panasonic_catalog_golden_records.json"

PRICE_TOLERANCE_PCT = 0.02  # 2% tolerance for floating-point reconstruction

def load_items():
    return {r["model"]: r for r in [
        json.loads(l) for l in ITEMS_FILE.read_text(encoding="utf-8").splitlines() if l.strip()
    ]}

def load_golden():
    return json.loads(GOLDEN_FILE.read_text(encoding="utf-8"))["records"]

def within_tolerance(got, expected, pct=PRICE_TOLERANCE_PCT):
    if expected is None:
        return True
    if got is None:
        return False
    if expected == 0:
        return got == 0
    return abs(got - expected) / abs(expected) <= pct

def main():
    items = load_items()
    golden = load_golden()
    all_items = list(items.values())

    failures = []
    ok = 0

    # 1. Golden record checks
    for rec in golden:
        model = rec["model"]
        if model not in items:
            failures.append(f"MISSING model: {model}")
            continue
        r = items[model]
        ok_rec = True
        if r["category"] != rec["expected_category"]:
            failures.append(f"CATEGORY  {model}: got={r['category']} expected={rec['expected_category']}")
            ok_rec = False
        if not r.get("subcategory"):
            failures.append(f"NO_SUBCAT {model}: subcategory is empty")
            ok_rec = False
        if rec["expected_price_net"] is not None:
            if not within_tolerance(r["price_net"], rec["expected_price_net"]):
                failures.append(
                    f"PRICE     {model}: got={r['price_net']} expected={rec['expected_price_net']}"
                )
                ok_rec = False
        if r["page"] != rec["expected_page"]:
            failures.append(f"PAGE      {model}: got={r['page']} expected={rec['expected_page']}")
            ok_rec = False
        if ok_rec:
            ok += 1

    # 2. Provenance checks
    missing_provenance = [r["model"] for r in all_items if not r.get("page") or not r.get("source_doc")]
    if missing_provenance:
        failures.append(f"MISSING PROVENANCE for: {missing_provenance[:10]}")

    # 3. Heat pump model completeness
    hp_no_model = [r["model"] for r in all_items if r["category"] == "heat_pumps" and not r.get("model")]
    if hp_no_model:
        failures.append(f"HEAT_PUMP_NO_MODEL: {len(hp_no_model)} records")

    # 4. Quality gate: missing model for heat_pumps must be 0
    hp_missing_model_count = sum(1 for r in all_items if r["category"] == "heat_pumps" and not r.get("model"))
    if hp_missing_model_count > 0:
        failures.append(f"QUALITY_GATE: {hp_missing_model_count} heat_pump records have no model (threshold: 0)")

    # 5. Coverage gate: must have all required categories
    required_cats = {
        "heat_pumps", "tanks", "buffers", "dhw_heat_pumps",
        "controllers_thermostats", "sensors_expansion_boards",
        "hydraulic_accessories", "communication_modules",
        "ventilation", "fan_coils",
    }
    present_cats = {r["category"] for r in all_items}
    missing_cats = required_cats - present_cats
    if missing_cats:
        failures.append(f"MISSING_CATEGORIES: {sorted(missing_cats)}")

    # Report
    print(f"Golden records: {len(golden)} | OK: {ok} | FAIL: {len(failures)}")
    if failures:
        for f in failures:
            print(f"  FAIL: {f}")
        print(f"\nResult: FAIL ({len(failures)} issues)")
        sys.exit(1)
    else:
        print("\nResult: PASS — normalized layer meets quality gates")
        sys.exit(0)

if __name__ == "__main__":
    main()

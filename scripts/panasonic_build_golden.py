#!/usr/bin/env python3
"""Build golden test set from extracted data with coordinate-verified prices."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
items = {r["model"]: r for r in [
    json.loads(l) for l in
    (ROOT / "data/normalized/catalog_items.jsonl").read_text(encoding="utf-8").splitlines()
    if l.strip()
]}

GOLDEN_MODELS = [
    # HEAT PUMPS - Gen L, K, J
    "KIT-WC03K3E5", "KIT-ADC03K3E5", "KIT-WXC09K3E5",
    "KIT-AXC09K9E8", "KIT-AQC09K9E8", "KIT-WC05L3E5",
    "WH-MDC05J3E5-1", "WH-MXC09J3E5", "WH-MXC09J3E8", "WH-MXC16J9E8",
    # TANKS
    "PAW-TD20C1E5-1", "PAW-TD30C1E5-1", "PAW-TD30C1E5HI-1",
    "SSWT-200-W1", "SSWT-300-W1",
    "PAW-TA15C1E5", "PAW-TA20C1E5STD",
    # BUFFERS
    "PAW-BTANK50L-2", "PAW-BTANK100L", "PAW-BTANKG200L", "PAW-BTANKG260L",
    "SSB-50U", "SSB-100",
    # DHW HEAT PUMPS
    "P-DHW200AE5", "P-DHW260AE5",
    # CONTROLLERS/THERMOSTATS
    "CZ-RTW2TAW1C", "PAW-A2W-RTWIRED",
    # SENSORS
    "CZ-NE2P", "CZ-NE4P", "PAW-A2W-TSOD",
    # COMMUNICATION
    "CZ-TAW1B", "PAW-AZAW-MBS-M", "PAW-AZAW-KNX-1",
    # VENTILATION
    "PAW-A2W-VENTA-L", "PAW-A2W-VENTA-R", "P-VEN15XQAZE5", "P-VEN30XQAZE5",
    # FAN COILS
    "P-FAL10SC-HLE", "P-FAL20SC-HLE", "P-FAL30SC-HLE", "P-FAL40SC-HLE",
]

golden = []
missing = []
for model in GOLDEN_MODELS:
    r = items.get(model)
    if not r:
        missing.append(model)
        print(f"MISSING: {model}")
        continue
    golden_rec = {
        "model": r["model"],
        "expected_category": r["category"],
        "expected_subcategory": r["subcategory"],
        "expected_price_net": r["price_net"],
        "expected_page": r["page"],
        "expected_generation": r["generation"],
        "extraction_confidence": r["extraction_confidence"],
        "verification_source": "coordinate_spatial_match",
        "notes": "",
    }
    golden.append(golden_rec)
    print(f"OK  {model:<32} cat={r['category']:<30} price={str(r['price_net']):<10} p={r['page']}")

out_path = ROOT / "tests" / "fixtures" / "panasonic_catalog_golden_records.json"
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(json.dumps({
    "version": "2",
    "source_doc": "Panasonic_cennik_pompy_ciepla_03.2026.pdf",
    "verification_method": "coordinate_spatial_price_matching",
    "notes": "Prices verified by y-coordinate spatial proximity of model word to price word on same page row.",
    "records": golden,
}, ensure_ascii=False, indent=2), encoding="utf-8")

print(f"\nGolden set: {len(golden)} records, {len(missing)} missing")
print(f"Written: {out_path}")

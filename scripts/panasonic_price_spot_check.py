#!/usr/bin/env python3
"""Quick spot-check of prices and categories against known PDF values."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
items = [json.loads(l) for l in (ROOT / "data/normalized/catalog_items.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
idx = {r["model"]: r for r in items}

KNOWN = [
    # Accessories page 13
    ("CZ-NE2P",           730,  "sensors_expansion_boards"),
    ("CZ-NE3P",           730,  "sensors_expansion_boards"),
    ("CZ-NE4P",           780,  "sensors_expansion_boards"),
    ("CZ-NE5P",           900,  "sensors_expansion_boards"),
    # Tanks page 9-10
    ("PAW-TD20C1E5-1",   6192,  "tanks"),
    ("PAW-TD30C1E5-1",   7450,  "tanks"),
    ("SSWT-200-W1",      6416,  "tanks"),
    ("SSWT-300-W1",      8840,  "tanks"),
    ("PAW-TA15C1E5",      None,  "tanks"),   # price unknown, just check category
    # Buffers page 11
    ("PAW-BTANK50L-2",   2430,  "buffers"),
    ("PAW-BTANK100L",    3160,  "buffers"),
    ("PAW-BTANKG200L",   4350,  "buffers"),
    # DHW pumps page 11
    ("P-DHW200AE5",      8940,  "dhw_heat_pumps"),
    ("P-DHW260AE5",      9350,  "dhw_heat_pumps"),
    # Ventilation page 14
    ("PAW-A2W-VENTA-L", 18300,  "ventilation"),
    ("PAW-A2W-VENTA-R", 18300,  "ventilation"),
    ("P-VEN15XQAZE5",   6090,   "ventilation"),
    # Fan coils page 15
    ("P-FAL10SC-HLE",   4150,   "fan_coils"),
    ("P-FAL20SC-HLE",   None,   "fan_coils"),
    # Heat pumps - Gen K split
    ("KIT-WC03K3E5",    None,   "heat_pumps"),
    ("KIT-ADC03K3E5",   None,   "heat_pumps"),
    ("KIT-WXC09K3E5",   None,   "heat_pumps"),
    # Communication
    ("CZ-TAW1B",        None,   "communication_modules"),
    ("PAW-AZAW-MBS-M",  None,   "communication_modules"),
]

ok_count = 0
fail_count = 0
missing_count = 0
for model, expected_price, expected_cat in KNOWN:
    r = idx.get(model)
    if not r:
        print(f"MISSING  {model}")
        missing_count += 1
        continue
    got_price = r["price_net"]
    got_cat = r["category"]
    price_ok = True
    if expected_price is not None:
        price_ok = got_price is not None and abs(got_price - expected_price) < 50
    cat_ok = got_cat == expected_cat
    if price_ok and cat_ok:
        print(f"OK       {model:<28} price={got_price} cat={got_cat}")
        ok_count += 1
    else:
        issues = []
        if not price_ok:
            issues.append(f"price: expected={expected_price} got={got_price}")
        if not cat_ok:
            issues.append(f"cat: expected={expected_cat} got={got_cat}")
        print(f"FAIL     {model:<28} {' | '.join(issues)}")
        fail_count += 1

print(f"\n--- {ok_count} OK / {fail_count} FAIL / {missing_count} MISSING (of {len(KNOWN)} checks) ---")
print(f"\nCategory distribution:")
cat_counts = {}
for r in items:
    cat_counts[r["category"]] = cat_counts.get(r["category"], 0) + 1
for k, v in sorted(cat_counts.items()):
    print(f"  {k}: {v}")
print(f"\nItems with price: {sum(1 for r in items if r['price_net'] is not None)}/{len(items)}")
print(f"Heat pumps missing model: {sum(1 for r in items if r['category']=='heat_pumps' and not r['model'])}")

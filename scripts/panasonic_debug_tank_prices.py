#!/usr/bin/env python3
"""Debug: show word positions for tank/DHW pages to understand price layout."""
import sys, json
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from panasonic_catalog_extract_v2 import *

PDF = ROOT / "panasonic" / "Panasonic_cennik_pompy_ciepla_03.2026.pdf"
TANK_MODELS = {
    "PAW-TD20C1E5-1", "PAW-TD30C1E5-1", "PAW-TD30C1E5HI-1",
    "SSWT-200-W1", "SSWT-300-W1", "SSWT-300-W2",
    "P-DHW200AE5", "P-DHW260AE5",
    "PAW-BTANK50L-2", "PAW-BTANK100L",
}

with pdfplumber.open(str(PDF)) as pdf:
    for pg_idx in (8, 9, 10):   # 0-indexed pages 9, 10, 11
        page = pdf.pages[pg_idx]
        i = pg_idx + 1
        words = page.extract_words(use_text_flow=False) or []
        for w in words:
            w["page_number"] = i
        prices = reconstruct_prices_from_words(words)
        print(f"\n=== PAGE {i} ===")
        print("Prices reconstructed:")
        for val, px0, px1, py, _ in sorted(prices, key=lambda x: x[3]):
            print(f"  {val:8.0f} PLN  x={px0:.0f}-{px1:.0f}  y={py:.0f}")
        print("Model word positions:")
        for w in words:
            t = clean(w["text"])
            if t in TANK_MODELS or t.rstrip("*") in TANK_MODELS:
                print(f"  {t:<28} x={float(w['x0']):.0f}  y={float(w['top']):.0f}")

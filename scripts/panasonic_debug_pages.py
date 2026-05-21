#!/usr/bin/env python3
"""Debug: trace what extract_single_col_records sees for pages 9-15."""
import sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from panasonic_catalog_extract_v2 import *

PDF = ROOT / "panasonic" / "Panasonic_cennik_pompy_ciepla_03.2026.pdf"

with pdfplumber.open(str(PDF)) as pdf:
    for i, page in enumerate(pdf.pages, 1):
        if i not in range(9, 16):
            continue
        text = clean(page.extract_text() or "")
        words = page.extract_words(use_text_flow=False) or []
        for w in words:
            w["page_number"] = i
        tables_raw = page.extract_tables() or []
        tables = [[[clean(c) for c in (row or [])] for row in t] for t in tables_raw]
        prices = reconstruct_prices_from_words(words)
        raw_records = extract_single_col_records(i, text, tables, words)
        print(f"P{i}: tables={len(tables)} prices={len(prices)} records={len(raw_records)}")
        for r in raw_records[:4]:
            print(f"  {r['model']} cat={r['category']} price={r['price_net']}")
        # show raw table data
        for ti, t in enumerate(tables):
            print(f"  table[{ti}]: {len(t)} rows, first={t[0][:3] if t else []}")

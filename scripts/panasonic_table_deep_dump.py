#!/usr/bin/env python3
"""Deep-dump: show every table row (up to 40 rows) for pages 2-15."""
import pdfplumber, json
from pathlib import Path

PDF = Path(__file__).resolve().parents[1] / "panasonic" / "Panasonic_cennik_pompy_ciepla_03.2026.pdf"
OUT = Path(__file__).resolve().parents[1] / "reports" / "panasonic_table_deep_dump.jsonl"

records = []
with pdfplumber.open(str(PDF)) as pdf:
    for i, page in enumerate(pdf.pages, 1):
        if i < 2 or i > 15:
            continue
        tables = page.extract_tables() or []
        text = (page.extract_text() or "").strip()
        for ti, table in enumerate(tables):
            clean_rows = []
            for row in (table or []):
                clean_row = [str(c or "").strip().replace("\n", " ") for c in row]
                if any(c for c in clean_row):
                    clean_rows.append(clean_row)
            records.append({"page": i, "table_idx": ti, "text_head": text[:200], "rows": clean_rows[:40]})

with OUT.open("w", encoding="utf-8", newline="\n") as f:
    for r in records:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")

for r in records:
    print(f"\n--- p{r['page']} t{r['table_idx']} | {r['text_head'][:80]}")
    for row in r["rows"]:
        print("  ", row)

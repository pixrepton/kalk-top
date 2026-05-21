#!/usr/bin/env python3
"""One-shot page audit: dumps raw text + table preview for every page of the Panasonic PDF."""
import json, sys
from pathlib import Path
import pdfplumber

PDF = Path(__file__).resolve().parents[1] / "panasonic" / "Panasonic_cennik_pompy_ciepla_03.2026.pdf"
OUT = Path(__file__).resolve().parents[1] / "reports" / "panasonic_page_audit_raw.jsonl"

records = []
with pdfplumber.open(str(PDF)) as pdf:
    for i, page in enumerate(pdf.pages, 1):
        text = (page.extract_text() or "").strip()
        words = page.extract_words() or []
        tables = page.extract_tables() or []

        word_sample = [w["text"] for w in words[:80]]
        table_shapes = [{"rows": len(t), "cols": max(len(r) for r in t if r) if t else 0, "first_row": [str(c or "")[:60] for c in (t[0] if t else [])]} for t in tables[:5]]

        records.append({
            "page": i,
            "text_len": len(text),
            "word_count": len(words),
            "table_count": len(tables),
            "text_head": text[:600],
            "word_sample": word_sample,
            "table_shapes": table_shapes,
        })

OUT.parent.mkdir(exist_ok=True)
with OUT.open("w", encoding="utf-8", newline="\n") as f:
    for r in records:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")

print(f"Audited {len(records)} pages -> {OUT}")
for r in records:
    print(f"\n=== PAGE {r['page']} | text_len={r['text_len']} words={r['word_count']} tables={r['table_count']} ===")
    print(r["text_head"][:400])
    for t in r["table_shapes"]:
        print(f"  TABLE rows={t['rows']} cols={t['cols']} first_row={t['first_row']}")

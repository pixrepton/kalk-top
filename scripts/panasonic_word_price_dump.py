#!/usr/bin/env python3
"""Dump all words with positions from pages 2-15 to understand price layout."""
import pdfplumber, json, re
from pathlib import Path

PDF = Path(__file__).resolve().parents[1] / "panasonic" / "Panasonic_cennik_pompy_ciepla_03.2026.pdf"
OUT = Path(__file__).resolve().parents[1] / "reports" / "panasonic_word_positions.jsonl"

PRICE_PAT = re.compile(r"^\d{1,3}(?:[\s]\d{3})*(?:,\d{2})?$")
MODEL_PAT = re.compile(r"^(KIT-|WH-|CU-|CZ-|PAW-|P-VEN|P-DHW|P-FAL|PCZ-|SSWT-|SSB-|S-\d)")

records = []
with pdfplumber.open(str(PDF)) as pdf:
    for i, page in enumerate(pdf.pages, 1):
        if i < 2 or i > 15:
            continue
        words = page.extract_words(use_text_flow=False) or []
        rows_by_y: dict[int, list] = {}
        for w in words:
            y_bucket = round(float(w["top"]) / 4) * 4
            rows_by_y.setdefault(y_bucket, []).append(w)

        price_words = [w for w in words if PRICE_PAT.match(w["text"].replace("\xa0", " ").replace(" ", " "))]
        model_words = [w for w in words if MODEL_PAT.match(w["text"])]
        records.append({
            "page": i,
            "total_words": len(words),
            "price_candidates": [(w["text"], round(float(w["x0"])), round(float(w["top"]))) for w in price_words],
            "model_candidates": [(w["text"], round(float(w["x0"])), round(float(w["top"]))) for w in model_words],
        })
        print(f"\n=== PAGE {i} ===")
        print(f"  Models: {[w['text'] for w in model_words[:20]]}")
        print(f"  Prices: {[w['text'] for w in price_words[:20]]}")

OUT.parent.mkdir(exist_ok=True)
with OUT.open("w", encoding="utf-8", newline="\n") as f:
    for r in records:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")

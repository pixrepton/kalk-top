#!/usr/bin/env python3
"""Debug is_model and candidate_models for problematic pages."""
import sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from panasonic_catalog_extract_v2 import *

# Test is_model directly
tests = ["PAW-TD20C1E5-1", "PAW-TD30C1E5-1", "SSWT-200-W1", "PAW-TA15C1E5",
         "P-VEN15XQAZE5", "P-FAL10SC-HLE", "PAW-BTANK50L-2", "SSB-50U",
         "P-DHW200AE5", "PCZ-AHRP0025", "PAW-VEN-ACCPCB", "CZ-NE2P"]
for m in tests:
    result = is_model(m)
    m_up = m.upper().strip()
    match = MODEL_RE.match(m_up)
    print(f"is_model({m!r}) = {result}  | regex_match={bool(match)}")

# Trace page 9 table
print("\n--- Page 9 table trace ---")
PDF = ROOT / "panasonic" / "Panasonic_cennik_pompy_ciepla_03.2026.pdf"
with pdfplumber.open(str(PDF)) as pdf:
    page9 = pdf.pages[8]  # 0-indexed
    tables_raw = page9.extract_tables() or []
    tables = [[[clean(c) for c in (row or [])] for row in t] for t in tables_raw]
    for ti, table in enumerate(tables):
        print(f"Table {ti}:")
        for ri, row in enumerate(table):
            print(f"  row {ri}: {row}")
            if not row:
                print("    SKIP: empty row")
                continue
            for ci, cell in enumerate(row):
                cell_clean = clean(cell or "")
                if not cell_clean:
                    print(f"    cell {ci}: SKIP empty")
                    continue
                candidate_models = [t for t in cell_clean.split() if is_model(t)]
                print(f"    cell {ci}: {cell_clean!r} split={cell_clean.split()} candidates={candidate_models}")
                if not candidate_models:
                    direct = is_model(cell_clean)
                    print(f"      fallback is_model({cell_clean!r})={direct}")
                    if direct:
                        candidate_models = [cell_clean]
                    else:
                        print(f"      MODEL_RE test: input={cell_clean.upper().strip()!r} match={bool(MODEL_RE.match(cell_clean.upper().strip()))}")

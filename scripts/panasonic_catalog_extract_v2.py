#!/usr/bin/env python3
"""Panasonic catalog extractor v2 — profile-per-section, coordinate-based price matching.

PROFILE MAP (discovered from page audit):
  Page 1           – cover, skip
  Pages 2-8        – heat_pumps (Hydraulic Split / Split / Monoblok, Gen K/L/M/J)
  Pages 9-10       – tanks (zbiorniki nierdzewne, emaliowane, kombinowane)
  Page 11          – buffers + dhw_heat_pumps
  Page 12          – controllers_thermostats + sensors_expansion_boards + hydraulic_accessories
  Page 13          – other_accessories + communication_modules
  Page 14          – ventilation
  Page 15          – fan_coils + fan_coil accessories (controllers_thermostats subset)
  Page 16          – footer, skip

TABLE STRUCTURE:
  Heat pump 5-col: [kit/desc, power_kw, indoor_model, heater_kw, outdoor_model]
  All other pages: single-col or multi-col header rows (model codes only)
  Prices: in text word layer, adjacent to model codes (Polish: "9 720 zł" = 9720 PLN)

PRICE FORMAT:
  Polish thousands separator is space.  "9 720" → 9720.  "17 210" → 17210.
  We reconstruct prices from consecutive numeric tokens on same y-row.
  kW indicators (3,5,6,7,9,12,16,20,25,30) are excluded from price candidates.
"""

from __future__ import annotations
import argparse, hashlib, json, re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
PDF_DEFAULT = ROOT / "panasonic" / "Panasonic_cennik_pompy_ciepla_03.2026.pdf"

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def sha256_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()

def clean(s: Any) -> str:
    if s is None:
        return ""
    return re.sub(r"\s+", " ", str(s)).strip()

def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

def write_jsonl(path: Path, records: list[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

def ensure(*paths: Path) -> None:
    for p in paths:
        p.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# model code patterns
# ---------------------------------------------------------------------------

MODEL_RE = re.compile(
    r"^("
    r"KIT-[A-Z0-9\-]+\*?|"
    r"WH-[A-Z0-9\-]+\*?|"
    r"CU-[A-Z0-9\-]+|"
    r"CZ-[A-Z0-9\-]+|"
    r"PAW-[A-Z0-9\-]+|"
    r"P-DHW[A-Z0-9\-]+|"
    r"P-VEN[A-Z0-9\-]+|"
    r"P-FAL[A-Z0-9\-]+|"
    r"PCZ-[A-Z0-9\-]+|"
    r"SSWT-[A-Z0-9\-]+|"
    r"SSB-[A-Z0-9\-]+|"
    r"S-\d[A-Z0-9\-]+"
    r")$"
)

KIT_RE = re.compile(r"^KIT-[A-Z0-9\-]+\*?$")
WH_RE = re.compile(r"^WH-[A-Z0-9\-]+\*?$")

def is_model(s: str) -> bool:
    return bool(MODEL_RE.match(s.upper().strip()))

def is_kit(s: str) -> bool:
    return bool(KIT_RE.match(s.upper().strip()))

# kW values that should NOT be interpreted as prices
KW_EXACT = {3, 5, 6, 7, 9, 12, 16, 20, 25, 30, 35, 40, 45}

# ---------------------------------------------------------------------------
# price reconstruction
# ---------------------------------------------------------------------------

def reconstruct_prices_from_words(words: list[dict]) -> list[tuple[float, float, float, float, float]]:
    """Return list of (price_value, x0, x1, y, page) tuples from word list.

    Polish format: '6 192 zł' → words ['6','192','zł'] on same y-row.
    Key rules:
    - gap < 18px for 2+3 digit sequences, gap < 38px for 1-digit prefix (thousands)
    - KW_EXACT only filters SINGLE-token numbers (multi-token sequences are always prices)
    - Minimum price threshold: 200 PLN (eliminates volume/capacity numbers below that)
    """
    if not words:
        return []

    rows: dict[int, list[dict]] = {}
    for w in words:
        bucket = round(float(w["top"]) / 3) * 3
        rows.setdefault(bucket, []).append(w)

    prices = []
    for _, row_words in sorted(rows.items()):
        row_words = sorted(row_words, key=lambda w: float(w["x0"]))
        i = 0
        while i < len(row_words):
            w = row_words[i]
            tok = clean(w["text"])
            if not tok.isdigit():
                i += 1
                continue
            seq = [tok]
            seq_words = [w]
            j = i + 1
            while j < len(row_words):
                nw = row_words[j]
                ntok = clean(nw["text"])
                if ntok.lower() in ("z\u0142", "zl", "pln"):
                    j += 1
                    break
                gap = float(nw["x0"]) - float(seq_words[-1]["x1"])
                # wider gap for 1-digit prefix so "6 192" (6192 PLN) is reconstructed correctly
                if ntok.isdigit() and len(ntok) == 3:
                    gap_limit = 40 if len(seq[-1]) <= 2 else 18
                    if gap <= gap_limit:
                        seq.append(ntok)
                        seq_words.append(nw)
                        j += 1
                    else:
                        break
                else:
                    break
            raw = "".join(seq)
            try:
                val = float(raw)
            except ValueError:
                i = j
                continue
            # Single-token kW values are not prices; multi-token sequences are always prices
            if len(seq) == 1 and val in KW_EXACT:
                i = j
                continue
            if val < 200:  # too small to be any Panasonic catalog price
                i = j
                continue
            x0 = float(seq_words[0]["x0"])
            x1 = float(seq_words[-1]["x1"])
            y = float(seq_words[0]["top"])
            p = float(seq_words[0].get("page_number", 0))
            prices.append((val, x0, x1, y, p))
            i = j
    return prices

# ---------------------------------------------------------------------------
# section profile detection
# ---------------------------------------------------------------------------

SECTION_PROFILES = [
    ("heat_pumps",                  [2, 3, 4, 5, 6, 7, 8]),
    ("tanks",                       [9, 10]),
    ("buffers",                     [11]),
    ("dhw_heat_pumps",              [11]),
    ("controllers_thermostats",     [12]),
    ("sensors_expansion_boards",    [12]),
    ("hydraulic_accessories",       [12]),
    ("other_accessories",           [13]),
    ("communication_modules",       [13]),
    ("ventilation",                 [14]),
    ("fan_coils",                   [15]),
]

def page_to_profiles(page_num: int) -> list[str]:
    return [p for p, pages in SECTION_PROFILES if page_num in pages]

def detect_primary_category_from_text(text: str, page_num: int) -> str:
    t = text.lower()
    if page_num in (2, 3, 4, 5, 6, 7, 8):
        return "heat_pumps"
    if page_num in (9, 10):
        return "tanks"
    if page_num == 11:
        if "bufor" in t:
            return "buffers"
        if "pompy ciepła do cwu" in t or "dhw" in t:
            return "dhw_heat_pumps"
        return "buffers"
    if page_num == 12:
        return "controllers_thermostats"
    if page_num == 13:
        if "komunikacja" in t or "modbus" in t or "knx" in t or "wifi" in t:
            return "communication_modules"
        return "other_accessories"
    if page_num == 14:
        return "ventilation"
    if page_num == 15:
        return "fan_coils"
    return "other_accessories"

def subcategory(model: str, text: str = "", page_num: int = 0) -> str:
    m = model.upper()
    t = text.lower()
    if m.startswith("KIT-"):
        return "kit_set"
    if m.startswith("WH-SDC") or m.startswith("WH-SXC") or m.startswith("WH-SXC"):
        return "indoor_hydrosplit"
    if m.startswith("WH-ADC") or m.startswith("WH-ADF"):
        return "indoor_aio"
    if m.startswith("WH-MDC") or m.startswith("WH-MXC"):
        return "monoblok"
    if m.startswith("WH-WDG") or m.startswith("WH-WXG") or m.startswith("WH-UDZ") or m.startswith("WH-UXZ") or m.startswith("WH-UQZ"):
        return "outdoor"
    if m.startswith("WH-CME"):
        return "control_module"
    if m.startswith("PAW-TD"):
        return "tank_stainless" if "c1e5" in m.lower() else "tank_combo"
    if m.startswith("PAW-TA"):
        return "tank_enameled"
    if m.startswith("SSWT-"):
        return "tank_stainless_termaco"
    if m.startswith("PAW-BTANK"):
        return "buffer_co"
    if m.startswith("SSB-"):
        return "buffer_co_sswt"
    if m.startswith("P-DHW"):
        return "dhw_heat_pump"
    if m.startswith("CZ-RTW") or m.startswith("PAW-A2W-RTW"):
        return "thermostat_controller"
    if m.startswith("CZ-NS") or m.startswith("CZ-NV"):
        return "expansion_board"
    if m.startswith("CZ-NE"):
        return "drip_tray_heater"
    if m.startswith("PAW-A2W-TS") or m.startswith("PAW-TS") or m.startswith("CZ-TK"):
        return "sensor"
    if m.startswith("PAW-A2W-KNX") or m.startswith("PAW-AZAW-MBS") or m.startswith("PAW-AW-MBS") or m.startswith("CZ-TAW"):
        return "communication_module"
    if m.startswith("CZ-NW") or m.startswith("PAW-A2W-EXTMETER") or m.startswith("PAW-A2W-CME") or m.startswith("CZ-UG"):
        return "smart_monitoring"
    if m.startswith("PAW-GRDBSE") or m.startswith("PAW-GRDSTD"):
        return "grounding_base"
    if m.startswith("PAW-3WYVLV") or m.startswith("PAW-A2W-AFVLV"):
        return "valve"
    if m.startswith("PAW-A2W-MGTFILTER"):
        return "filter"
    if m.startswith("PAW-A2W-VENTA") or m.startswith("P-VEN"):
        return "hrv_unit"
    if m.startswith("PAW-VEN-"):
        return "hrv_accessory"
    if m.startswith("PCZ-AHRP") or m.startswith("PCZ-STE"):
        return "hrv_aquarea_vent"
    if m.startswith("P-FAL"):
        return "fan_coil_unit"
    if m.startswith("PCZ-EEB") or m.startswith("PCZ-EFB") or m.startswith("PCZ-"):
        return "fan_coil_accessory"
    return "unclassified"

def guess_generation(text: str, model: str = "") -> str:
    combined = (text + " " + model).upper()
    for g in ("GENERACJI M", "GENERACJI L", "GENERACJI K", "GENERACJI J", "GENERACJI H"):
        if g in combined:
            return g[-1]
    if "T-CAP" in combined:
        return "K_or_L_tcap"
    if "-M3E5" in combined or "-M3E8" in combined or "-M6E" in combined or "-M9E" in combined:
        return "M"
    if "-L3E5" in combined or "-LE5" in combined:
        return "L"
    if "-K3E5" in combined or "-K6E5" in combined or "-K9E8" in combined or "KE5" in combined or "KE8" in combined:
        return "K"
    if "-J3E5" in combined or "-J6E5" in combined or "-J9E8" in combined or "JE5" in combined or "JE8" in combined:
        return "J"
    return "unknown"

def guess_series(text: str, model: str = "") -> str:
    combined = (text + " " + model).upper()
    if "T-CAP" in combined:
        return "T-CAP"
    if "HIGH PERFORMANCE" in combined:
        return "High Performance"
    if "ECOFLEX" in combined:
        return "EcoFlex"
    if "SUPER CICHA" in combined or "SUPER QUIET" in combined or "WQC" in combined.upper() or "UQZ" in combined.upper():
        return "T-CAP Super Quiet"
    return ""

def guess_unit_type(model: str, description: str = "") -> str:
    m = model.upper()
    d = description.upper()
    if "KIT-" in m:
        if "ADC" in m:
            return "kit_split_aio"
        if "AXC" in m or "AQC" in m:
            return "kit_split_aio_tcap"
        return "kit_split"
    if "MONOBLOK" in d or "WH-MDC" in m or "WH-MXC" in m:
        return "monoblok"
    if "ALL IN ONE" in d or "WH-ADC" in m or "WH-ADF" in m:
        return "all_in_one"
    if "HYDRAULIC SPLIT" in d or "HYDROSPLIT" in d:
        return "hydraulic_split"
    if "SPLIT" in d and "WH-SXC" in m:
        return "split_tcap"
    if "SPLIT" in d:
        return "split"
    return ""

def guess_phase(text: str, model: str = "") -> str:
    combined = (text + " " + model).lower()
    if "trzyfaz" in combined or "tr\u00f3jfaz" in combined or "3f" in combined or "3-faz" in combined or "3x" in combined or "e8" in combined:
        return "3-phase"
    if "jednofaz" in combined or "1-faz" in combined or "230v" in combined or "1f" in combined or "e5" in combined:
        return "1-phase"
    return "unknown"

def guess_refrigerant(text: str, model: str = "") -> str:
    combined = (text + " " + model).upper()
    if "R290" in combined:
        return "R290"
    if "R32" in combined:
        return "R32"
    if "R410A" in combined:
        return "R410A"
    return "unknown"

def guess_power_kw(row: list[str]) -> float | None:
    for cell in row:
        m = re.search(r"(\d+)\s*kW", cell, re.IGNORECASE)
        if m:
            return float(m.group(1))
    return None

def guess_tank_volume(model: str, text: str = "") -> int | None:
    combined = model.upper() + " " + text.upper()
    for pat, vol in [
        (r"TD20", 200), (r"TD30", 300), (r"TA15", 150), (r"TA20", 200),
        (r"TA30", 300), (r"TA40", 400), (r"TD23", 230),
        (r"SSWT-200", 200), (r"SSWT-300", 300),
        (r"BTANK50", 50), (r"BTANK100", 100), (r"BTANKG200", 200), (r"BTANKG260", 260),
        (r"SSB-50", 50), (r"SSB-100", 100), (r"SSB-200", 200), (r"SSB-300", 300),
        (r"P-DHW200", 200), (r"P-DHW260", 260),
    ]:
        if re.search(pat, combined):
            return vol
    return None

# ---------------------------------------------------------------------------
# coordinate-based price matcher
# ---------------------------------------------------------------------------

def find_price_for_model(
    model_x0: float,
    model_y: float,
    prices: list,
    y_tolerance: float = 10.0,
    min_price: float = 200.0,
) -> float | None:
    """Find the nearest price to the right of a model code on approximately same y-row.

    min_price filters out capacity/volume numbers that look like prices.
    For tanks/buffers/DHW, pass min_price >= 2000 to skip volume numbers like 200, 280, 300.
    """
    filtered = [(val, px0, px1, py, pp) for (val, px0, px1, py, pp) in prices if val >= min_price]
    candidates = []
    for price_val, px0, px1, py, _ in filtered:
        if abs(py - model_y) <= y_tolerance:
            if px0 >= model_x0 - 5:
                candidates.append((abs(px0 - model_x0), price_val))
    if not candidates:
        for price_val, px0, px1, py, _ in filtered:
            if abs(py - model_y) <= y_tolerance * 3:
                if px0 >= model_x0 - 5:
                    candidates.append((abs(px0 - model_x0) + abs(py - model_y) * 2, price_val))
    if not candidates:
        return None
    candidates.sort(key=lambda x: x[0])
    return candidates[0][1]


def min_price_for_model(model: str) -> float:
    """Return minimum credible price for a model to filter out capacity/volume numbers."""
    m = model.upper()
    if m.startswith("PAW-TD") or m.startswith("PAW-TA") or m.startswith("SSWT-"):
        return 2000.0   # tanks cost at least 2000 PLN
    if m.startswith("PAW-BTANK") or m.startswith("SSB-"):
        return 1500.0   # buffers at least 1500 PLN
    if m.startswith("P-DHW"):
        return 5000.0   # DHW heat pumps at least 5000 PLN
    if any(m.startswith(p) for p in ("KIT-", "WH-MDC", "WH-MXC")):
        return 5000.0   # monobloks and kits
    if any(m.startswith(p) for p in ("WH-SDC", "WH-SXC", "WH-ADC")):
        return 2000.0   # indoor units
    if any(m.startswith(p) for p in ("WH-WDG", "WH-WXG", "WH-UDZ", "WH-UXZ", "WH-UQZ")):
        return 3000.0   # outdoor units
    if any(m.startswith(p) for p in ("P-VEN", "PAW-A2W-VENTA")):
        return 3000.0   # ventilation units
    if m.startswith("P-FAL"):
        return 2000.0   # fan coils
    return 200.0         # accessories can be inexpensive

# ---------------------------------------------------------------------------
# per-profile extractors
# ---------------------------------------------------------------------------

def extract_heat_pump_records(
    page_num: int,
    text: str,
    tables: list[list[list[str]]],
    words: list[dict],
) -> list[dict]:
    """Extract heat pump records from 5-col tables + word-based prices."""
    prices = reconstruct_prices_from_words(words)
    word_by_text: dict[str, list[dict]] = {}
    for w in words:
        word_by_text.setdefault(clean(w["text"]), []).append(w)

    records = []
    generation = guess_generation(text)
    series = guess_series(text)
    refrigerant = guess_refrigerant(text)
    phase = guess_phase(text)

    for table in tables:
        prev_indoor = ""
        prev_kit = ""
        for row in table:
            if not row:
                continue
            row_clean = [clean(c) for c in row]
            # 5-column heat pump table: [kit/desc, power, indoor, heater, outdoor]
            if len(row_clean) >= 4:
                col0 = row_clean[0]
                col1 = row_clean[1] if len(row_clean) > 1 else ""
                col2 = row_clean[2] if len(row_clean) > 2 else ""
                col4 = row_clean[4] if len(row_clean) > 4 else ""

                kit_model = ""
                unit_type = ""
                if is_kit(col0):
                    kit_model = col0.rstrip("*")
                    prev_kit = kit_model
                    unit_type = guess_unit_type(kit_model, text)
                elif col0.upper() in ("HYDROSPLIT", "HYDROSPLIT ALL IN ONE", "MONOBLOK"):
                    # description row — use previous kit structure
                    unit_type = "hydraulic_split" if "HYDROSPLIT" in col0.upper() else "monoblok"
                    kit_model = prev_kit
                elif col2 and is_model(col2):
                    # controller/module row
                    kit_model = ""
                elif col0.upper().startswith("STEROWNIK") or col0.upper().startswith("MODU"):
                    kit_model = ""
                else:
                    kit_model = ""

                indoor = col2.rstrip("*") if col2 and is_model(col2) else prev_indoor
                if col2 and is_model(col2):
                    prev_indoor = indoor
                outdoor = col4.rstrip("*") if col4 and is_model(col4) else ""

                power_kw = guess_power_kw(row_clean)
                model_gen = guess_generation(text, indoor or kit_model)
                model_phase = guess_phase(text, indoor or kit_model)
                model_series = guess_series(text, indoor or kit_model)

                # find price for this kit code in word layer
                price = None
                primary_model = kit_model or indoor
                if primary_model:
                    _mp = min_price_for_model(primary_model)
                    for w in word_by_text.get(primary_model, []) + word_by_text.get(primary_model + "*", []):
                        price = find_price_for_model(float(w["x0"]), float(w["top"]), prices, min_price=_mp)
                        if price:
                            break
                    # fallback: try the kit in table row — search by y proximity of first cell
                    if price is None and row_clean[0]:
                        for w in words:
                            if clean(w["text"]) == row_clean[0] or clean(w["text"]).rstrip("*") == row_clean[0].rstrip("*"):
                                price = find_price_for_model(float(w["x0"]), float(w["top"]), prices, min_price=_mp)
                                if price:
                                    break

                if not primary_model:
                    continue

                records.append({
                    "model": primary_model,
                    "kit_model": kit_model,
                    "indoor_unit": indoor,
                    "outdoor_unit": outdoor,
                    "unit_type": unit_type or guess_unit_type(primary_model, text),
                    "power_kw": power_kw,
                    "series": model_series or series,
                    "generation": model_gen if model_gen != "unknown" else generation,
                    "phase": model_phase if model_phase != "unknown" else phase,
                    "refrigerant": refrigerant,
                    "category": "heat_pumps",
                    "subcategory": subcategory(primary_model, text),
                    "price_net": price,
                    "_page": page_num,
                    "_row_text": " | ".join(row_clean),
                })

            # 1-column monoblok/standalone tables
            elif len(row_clean) == 1 and row_clean[0]:
                model = row_clean[0].rstrip("*")
                if not is_model(model):
                    continue
                price = None
                _mp2 = min_price_for_model(model)
                for w in word_by_text.get(row_clean[0], []) + word_by_text.get(model, []):
                    price = find_price_for_model(float(w["x0"]), float(w["top"]), prices, min_price=_mp2)
                    if price:
                        break
                records.append({
                    "model": model,
                    "kit_model": "",
                    "indoor_unit": model if model.startswith("WH-") else "",
                    "outdoor_unit": "",
                    "unit_type": guess_unit_type(model, text),
                    "power_kw": None,
                    "series": guess_series(text, model),
                    "generation": guess_generation(text, model),
                    "phase": guess_phase(text, model),
                    "refrigerant": refrigerant,
                    "category": "heat_pumps",
                    "subcategory": subcategory(model, text),
                    "price_net": price,
                    "_page": page_num,
                    "_row_text": model,
                })

    # deduplicate by model, keep first non-null price
    seen: dict[str, dict] = {}
    for r in records:
        k = r["model"]
        if k not in seen or (seen[k]["price_net"] is None and r["price_net"] is not None):
            seen[k] = r
    return list(seen.values())


def extract_single_col_records(
    page_num: int,
    text: str,
    tables: list[list[list[str]]],
    words: list[dict],
    category_override: str | None = None,
) -> list[dict]:
    """General extractor for pages 9-15: single-col model lists + word-layer prices."""
    prices = reconstruct_prices_from_words(words)
    word_by_text: dict[str, list[dict]] = {}
    for w in words:
        word_by_text.setdefault(clean(w["text"]), []).append(w)

    records = []
    page_category = detect_primary_category_from_text(text, page_num)

    for table in tables:
        for row in table:
            if not row:
                continue
            for cell in row:
                cell_clean = clean(cell or "")
                if not cell_clean:
                    continue
                # multi-model cells (page 12 tables have 5-6 models per row)
                candidate_models = [t for t in cell_clean.split() if is_model(t)]
                if not candidate_models and is_model(cell_clean):
                    candidate_models = [cell_clean]
                for model_raw in candidate_models:
                    model = model_raw.rstrip("*")
                    if not is_model(model):
                        continue
                    # determine category from model prefix, overriding page-level if needed
                    if category_override:
                        cat = category_override
                    else:
                        sub = subcategory(model, text)
                        cat = page_category
                        # refine category based on model subcategory
                        if sub in ("sensor", "drip_tray_heater"):
                            cat = "sensors_expansion_boards"
                        elif sub == "expansion_board":
                            cat = "sensors_expansion_boards"
                        elif sub in ("thermostat_controller",):
                            cat = "controllers_thermostats"
                        elif sub in ("valve", "filter", "grounding_base"):
                            cat = "hydraulic_accessories"
                        elif sub in ("communication_module", "smart_monitoring"):
                            cat = "communication_modules"
                        elif sub in ("hrv_unit", "hrv_accessory", "hrv_aquarea_vent"):
                            cat = "ventilation"
                        elif sub in ("fan_coil_unit", "fan_coil_accessory"):
                            cat = "fan_coils"
                        elif sub in ("tank_stainless", "tank_enameled", "tank_combo", "tank_stainless_termaco", "tank_combo"):
                            cat = "tanks"
                        elif sub in ("buffer_co", "buffer_co_sswt"):
                            cat = "buffers"
                        elif sub == "dhw_heat_pump":
                            cat = "dhw_heat_pumps"

                # find price
                price = None
                _mp = min_price_for_model(model)
                for w in word_by_text.get(model_raw, []) + word_by_text.get(model, []):
                    price = find_price_for_model(float(w["x0"]), float(w["top"]), prices, min_price=_mp)
                    if price:
                        break

                vol = guess_tank_volume(model, text)
                records.append({
                    "model": model,
                    "kit_model": "",
                    "indoor_unit": "",
                    "outdoor_unit": "",
                    "unit_type": "",
                    "power_kw": None,
                    "tank_volume_l": vol if cat in ("tanks", "buffers", "dhw_heat_pumps") else None,
                    "buffer_volume_l": vol if cat == "buffers" else None,
                    "series": "",
                    "generation": "unknown",
                    "phase": "unknown",
                    "refrigerant": "unknown",
                    "category": cat,
                    "subcategory": subcategory(model, text),
                    "price_net": price,
                    "_page": page_num,
                    "_row_text": cell_clean,
                })

    # deduplicate
    seen: dict[str, dict] = {}
    for r in records:
        k = r["model"]
        if k not in seen or (seen[k]["price_net"] is None and r["price_net"] is not None):
            seen[k] = r
    return list(seen.values())


# ---------------------------------------------------------------------------
# record finaliser
# ---------------------------------------------------------------------------

_ITEM_COUNTER = 0

def make_item(
    raw: dict,
    state_effective_date: str,
    source_doc: str,
) -> dict:
    global _ITEM_COUNTER
    _ITEM_COUNTER += 1
    page = raw["_page"]
    model = raw["model"]
    cat = raw["category"]
    description = raw.get("_row_text", "")[:240]
    extraction_confidence = (
        0.95 if model and raw.get("price_net") is not None
        else 0.7 if model
        else 0.4
    )
    return {
        "id": f"panasonic-2026-p{page}-{_ITEM_COUNTER:04d}",
        "source_doc": source_doc,
        "source_vendor": "Schiessl",
        "source_brand": "Panasonic",
        "source_effective_date": state_effective_date,
        "page": page,
        "section": cat,
        "subsection": raw.get("subcategory", ""),
        "category": cat,
        "subcategory": raw.get("subcategory", ""),
        "product_family": "Aquarea" if any(x in model for x in ("KIT-", "WH-", "PAW-")) else "",
        "series": raw.get("series", ""),
        "generation": raw.get("generation", "unknown"),
        "product_name": model,
        "model": model,
        "sku_or_catalog_code": model,
        "description_short": description,
        "phase": raw.get("phase", "unknown"),
        "refrigerant": raw.get("refrigerant", "unknown"),
        "unit_type": raw.get("unit_type", ""),
        "indoor_unit": raw.get("indoor_unit", ""),
        "outdoor_unit": raw.get("outdoor_unit", ""),
        "tank_volume_l": raw.get("tank_volume_l"),
        "buffer_volume_l": raw.get("buffer_volume_l"),
        "heater_kw": None,
        "power_kw": raw.get("power_kw"),
        "price_net": raw.get("price_net"),
        "bundle_price_net": raw.get("price_net"),
        "currency": "PLN",
        "includes_wifi": "wifi" in description.lower() or model in ("CZ-TAW1B", "CZ-RTW2TAW1C"),
        "notes": "",
        "extraction_confidence": extraction_confidence,
        "uncertainty_notes": "" if model and raw.get("price_net") is not None else (
            "price_not_found" if model and raw.get("price_net") is None else "model_not_found"
        ),
        "source_text_fragment": description,
        "category_specific": {
            "kit_model": raw.get("kit_model", ""),
        },
    }


# ---------------------------------------------------------------------------
# main pipeline
# ---------------------------------------------------------------------------

def run(pdf_path: Path) -> None:
    global _ITEM_COUNTER
    _ITEM_COUNTER = 0

    data_raw = ROOT / "data" / "raw"
    data_norm = ROOT / "data" / "normalized"
    mem_ent = ROOT / "memory" / "entities"
    mem_rel = ROOT / "memory" / "relations"
    mem_fct = ROOT / "memory" / "facts"
    knowledge = ROOT / "knowledge" / "panasonic"
    ctx = ROOT / "context"
    reports = ROOT / "reports"
    ensure(
        data_raw, data_norm, mem_ent, mem_rel, mem_fct, knowledge,
        ctx / "offering", ctx / "service", ctx / "selection",
        ctx / "pricing", ctx / "llm", reports,
    )

    effective_date = "03.2026"
    source_doc = pdf_path.name

    all_items: list[dict] = []
    pages_records: list[dict] = []
    table_records: list[dict] = []
    section_set: set[str] = set()
    category_set: set[str] = set()

    with pdfplumber.open(str(pdf_path)) as pdf:
        for i, page in enumerate(pdf.pages, 1):
            text = clean(page.extract_text() or "")
            words = page.extract_words(use_text_flow=False) or []
            # inject page_number for later ref
            for w in words:
                w["page_number"] = i
            tables_raw = page.extract_tables() or []
            tables = [
                [[clean(c) for c in (row or [])] for row in t]
                for t in tables_raw
            ]

            page_profiles = page_to_profiles(i)
            section_set.update(page_profiles)

            pages_records.append({
                "page": i,
                "section_guess": page_profiles[0] if page_profiles else "other",
                "text_len": len(text),
                "table_count": len(tables),
                "table_presence": bool(tables),
                "image_heavy": len(text) < 100,
                "raw_text": text,
                "extraction_notes": "",
            })
            for ti, t in enumerate(tables_raw):
                table_records.append({
                    "source_doc": source_doc,
                    "page": i,
                    "table_index": ti,
                    "section_guess": page_profiles[0] if page_profiles else "other",
                    "rows": [[clean(c) for c in (row or [])] for row in t],
                })

            if i == 1 or i == 16:
                continue  # cover + footer

            raw_records: list[dict] = []
            if i in range(2, 9):
                raw_records = extract_heat_pump_records(i, text, tables, words)
            else:
                raw_records = extract_single_col_records(i, text, tables, words)

            for r in raw_records:
                item = make_item(r, effective_date, source_doc)
                category_set.add(item["category"])
                all_items.append(item)

    manifest = {
        "file_name": source_doc,
        "file_hash": sha256_file(pdf_path),
        "effective_date": effective_date,
        "source_vendor": "Schiessl",
        "source_brand": "Panasonic",
        "total_pages": 16,
        "detected_sections": sorted(section_set),
        "detected_categories": sorted(category_set),
        "extraction_method": "pdfplumber_profiled_v2",
        "extraction_timestamp": utc_now(),
        "extractor_version": "2",
    }

    # raw layer
    write_json(data_raw / "panasonic_2026_pdf_manifest.json", manifest)
    write_jsonl(data_raw / "panasonic_2026_pages.jsonl", pages_records)
    write_json(data_raw / "panasonic_2026_sections.json", {
        "source_doc": source_doc,
        "sections": sorted(section_set),
        "categories": sorted(category_set),
    })
    write_jsonl(data_raw / "panasonic_2026_tables.jsonl", table_records)

    # normalized layer
    write_jsonl(data_norm / "catalog_items.jsonl", all_items)

    def items_where(cats: set[str]) -> list[dict]:
        return [r for r in all_items if r["category"] in cats]

    products = items_where({"heat_pumps"})
    accessories = items_where({"controllers_thermostats", "sensors_expansion_boards", "hydraulic_accessories", "communication_modules", "other_accessories"})
    tanks_buffers = items_where({"tanks", "buffers", "dhw_heat_pumps"})
    vent_fan = items_where({"ventilation", "fan_coils"})

    write_jsonl(data_norm / "products.jsonl", products)
    write_jsonl(data_norm / "accessories.jsonl", accessories)
    write_jsonl(data_norm / "tanks_buffers.jsonl", tanks_buffers)
    write_jsonl(data_norm / "ventilation_and_fancoils.jsonl", vent_fan)

    families: dict[str, dict] = {}
    model_index: dict[str, dict] = {}
    pricing_index: dict[str, dict] = {}
    generation_index: dict[str, list[str]] = {}
    compatibility_map: dict[str, Any] = {"indoor_outdoor": [], "series_links": []}

    for rec in all_items:
        fam = rec["product_family"] or "unknown_family"
        families.setdefault(fam, {"family": fam, "categories": set(), "models": set(), "generations": set()})
        families[fam]["categories"].add(rec["category"])
        if rec["model"]:
            families[fam]["models"].add(rec["model"])
            if rec["generation"] != "unknown":
                families[fam]["generations"].add(rec["generation"])
            model_index[rec["model"]] = {
                "model": rec["model"],
                "category": rec["category"],
                "family": fam,
                "generation": rec["generation"],
                "page": rec["page"],
                "price_net": rec["price_net"],
                "source_doc": rec["source_doc"],
                "subcategory": rec["subcategory"],
                "unit_type": rec["unit_type"],
            }
            pricing_index[rec["model"]] = {
                "price_net": rec["price_net"],
                "currency": rec["currency"],
                "page": rec["page"],
            }
            generation_index.setdefault(rec["generation"], []).append(rec["model"])

        # build indoor/outdoor links for heat pump KIT records
        if rec["category"] == "heat_pumps" and rec.get("kit_model") and rec.get("indoor_unit") and rec.get("outdoor_unit"):
            compatibility_map["indoor_outdoor"].append({
                "kit": rec["kit_model"],
                "indoor": rec["indoor_unit"],
                "outdoor": rec["outdoor_unit"],
                "generation": rec["generation"],
                "series": rec["series"],
            })

    families_out = [
        {"family": k, "categories": sorted(v["categories"]), "models": sorted(v["models"]), "generations": sorted(v["generations"])}
        for k, v in families.items()
    ]
    write_json(data_norm / "product_families.json", {"families": families_out})
    write_json(data_norm / "generation_index.json", generation_index)
    write_json(data_norm / "model_index.json", model_index)
    write_json(data_norm / "compatibility_map.json", compatibility_map)
    write_json(data_norm / "pricing_index.json", pricing_index)

    # memory layer
    write_json(mem_ent / "panasonic_product_families.json", {"families": families_out})
    write_json(mem_ent / "panasonic_model_index.json", model_index)
    write_json(mem_ent / "panasonic_category_map.json", {
        "heat_pumps": "glowne pompy ciepla Aquarea (split, monoblok, hydraulic split, AIO)",
        "tanks": "zasobniki CWU nierdzewne i emaliowane",
        "buffers": "bufory CO instalacyjne",
        "dhw_heat_pumps": "pompy ciepla do CWU",
        "controllers_thermostats": "sterowniki i termostaty",
        "sensors_expansion_boards": "czujniki, rozszerzenia, grza\u0142ki",
        "hydraulic_accessories": "hydraulika, zawory, filtry",
        "communication_modules": "modul WiFi, Modbus, KNX",
        "other_accessories": "pozostale akcesoria i grza\u0142ki",
        "ventilation": "rekuperacja VENTA / AQUAREA VENT i akcesoria",
        "fan_coils": "klimakonwektory i akcesoria",
    })
    write_json(mem_rel / "panasonic_indoor_outdoor_links.json", compatibility_map)
    write_json(mem_rel / "panasonic_generation_family_links.json", {
        "generation_index": generation_index,
        "families": families_out,
    })
    write_jsonl(mem_fct / "panasonic_pricing_facts.jsonl", [
        {"fact_type": "price", "model": r["model"], "price_net": r["price_net"],
         "currency": r["currency"], "source_doc": r["source_doc"], "page": r["page"]}
        for r in all_items if r["model"] and r["price_net"] is not None
    ])
    write_jsonl(mem_fct / "panasonic_compatibility_facts.jsonl", [
        {"fact_type": "compatibility", "model": r["model"], "family": r["product_family"],
         "series": r["series"], "generation": r["generation"],
         "indoor_unit": r["indoor_unit"], "outdoor_unit": r["outdoor_unit"]}
        for r in products if r["model"]
    ])
    write_json(mem_fct / "panasonic_naming_rules.json", {
        "rules": [
            "KIT-* = kompletny zestaw (indoor + outdoor + ewentualnie zasobnik)",
            "WH-SDC/SXC/SQC = jednostka wewnetrzna hydrosplit",
            "WH-ADC/ADF = jednostka wewnetrzna all-in-one ze zasobnikiem",
            "WH-MDC/MXC = monoblok",
            "WH-WDG/WXG/UDZ/UXZ/UQZ = jednostka zewnetrzna",
            "WH-CME = modul sterowania (bez jednostki wewn.)",
            "PAW-TD = zasobnik nierdzewny (TD20=200l TD30=300l)",
            "PAW-TA = zasobnik emaliowany",
            "SSWT- = zasobnik nierdzewny Termaco",
            "PAW-BTANK = bufor CO",
            "SSB- = bufor CO SSWT",
            "P-DHW = pompa ciepla CWU",
            "CZ-RTW/PAW-A2W-RTW = sterownik/termostat",
            "CZ-NS/NV = rozszerzenia i plytki",
            "CZ-NE = grza\u0142ki tacy ociekowej",
            "PAW-A2W-TS/PAW-TS/CZ-TK = czujniki",
            "PAW-AZAW-MBS/KNX/CZ-TAW = komunikacja",
            "P-VEN/PAW-VEN/PCZ-AHRP = rekuperacja",
            "P-FAL/PCZ- = klimakonwektory i akcesoria",
        ],
        "confidence": "high",
    })

    # knowledge layer (content-derived)
    hp_models = sorted({r["model"] for r in products if r["model"]})
    hp_gen_map: dict[str, list[str]] = {}
    for r in products:
        hp_gen_map.setdefault(r["generation"], []).append(r["model"])

    (knowledge / "catalog_overview.md").write_text(
        f"# Panasonic cennik 03.2026 — przeglad\n\n"
        f"- Zrodlo: `{source_doc}`\n"
        f"- Strony: 16 (2-8 pompy, 9-10 zbiorniki, 11 bufory/DHW, 12-13 akcesoria, 14 rekuperacja, 15 klimakonwektory)\n"
        f"- Liczba rekordow: {len(all_items)}\n"
        f"- Liczba modeli z cena: {sum(1 for r in all_items if r['price_net'] is not None)}\n"
        f"- Liczba modeli bez ceny: {sum(1 for r in all_items if r['price_net'] is None)}\n"
        f"- Kategorie: {', '.join(sorted(category_set))}\n"
        f"\n## Wersja ekstraktora: v2 (profiled, coordinate-based prices)\n",
        encoding="utf-8",
    )
    (knowledge / "aquarea_families.md").write_text(
        "# Rodziny Aquarea\n\n"
        "## Generacje\n\n"
        + "\n".join(f"- **Generacja {g}**: {len(v)} modeli" for g, v in sorted(hp_gen_map.items()) if g != "unknown")
        + f"\n\n## Wszystkie modele KIT\n\n"
        + "\n".join(f"- `{m}`" for m in hp_models if m.startswith("KIT-"))[:5000],
        encoding="utf-8",
    )
    (knowledge / "generations_guide.md").write_text(
        "# Przewodnik po generacjach Panasonic Aquarea\n\n"
        "- **Generacja L** (str. 2): Hydraulic Split, R290, A+++, CWU 65°C bez grzałki, zasobnik CWU\n"
        "- **Generacja M** (str. 3-4): Hydraulic Split + T-CAP Hydraulic Split, R290, A+++, do -25°C\n"
        "- **Generacja K** (str. 4-6): Split + T-CAP Split, AIO 185/260 l, R32, do -28°C (T-CAP)\n"
        "- **Generacja J** (str. 7-8): Monoblok jedno- i trzyfazowy, R32, A+++\n"
        "- **EcoFlex** (str. 5): Split AIO, R32, odzysk ciepła tryb CWU\n",
        encoding="utf-8",
    )
    cat_counts = {}
    for r in all_items:
        cat_counts[r["category"]] = cat_counts.get(r["category"], 0) + 1
    (knowledge / "product_categories_guide.md").write_text(
        "# Kategorie produktow\n\n"
        + "\n".join(f"- **{k}**: {v} rekordow" for k, v in sorted(cat_counts.items())),
        encoding="utf-8",
    )
    (knowledge / "accessories_and_controls.md").write_text(
        "# Akcesoria i sterowanie (str. 12-13)\n\n"
        "Zbudowane z `accessories.jsonl`. Kategorie:\n"
        "- controllers_thermostats: sterowniki CZ-RTW2, PAW-A2W-RTW*\n"
        "- sensors_expansion_boards: czujniki PAW-TS*, CZ-TK*, rozszerzenia CZ-NS*, CZ-NE* (grz. tacy)\n"
        "- hydraulic_accessories: zawory PAW-A2W-AFVLV, PAW-3WYVLV, filtry PAW-A2W-MGTFILTER\n"
        "- communication_modules: WiFi CZ-TAW1B, Modbus PAW-AZAW-MBS*, KNX PAW-AZAW-KNX*\n"
        "- other_accessories: grza\u0142ki tacy CZ-NE*, bazy PAW-GRDBSE*, podstawy PAW-GRDSTD*\n",
        encoding="utf-8",
    )
    (knowledge / "tanks_buffers_and_dhw.md").write_text(
        "# Zbiorniki, bufory i pompy CWU (str. 9-11)\n\n"
        "- **Zbiorniki nierdzewne AQUAREA** (str. 9): PAW-TD20/30C1E5 (200/300 l)\n"
        "- **Zbiorniki nierdzewne SSWT Termaco** (str. 9): SSWT-200/300-W1/W2\n"
        "- **Zbiorniki emaliowane AQUAREA** (str. 10): PAW-TA15/20/30/40C1E5 (150-400 l)\n"
        "- **Zbiorniki kombinowane AQUAREA** (str. 10): PAW-TD20B8E3, PAW-TD23B6E5\n"
        "- **Bufory CO AQUAREA** (str. 11): PAW-BTANK50/100/G200/G260L (50-260 l)\n"
        "- **Bufory CO SSWT** (str. 11): SSB-50U/100/100U/200/300 (50-300 l)\n"
        "- **Pompy CWU AQUAREA** (str. 11): P-DHW200/260AE5/CAE5 (200/260 l)\n",
        encoding="utf-8",
    )
    (knowledge / "ventilation_and_fancoils.md").write_text(
        "# Rekuperacja i klimakonwektory (str. 14-15)\n\n"
        "## Rekuperacja (str. 14)\n"
        "- **VENTA** (PAW-A2W-VENTA-L/R): dwuwentylatorowe z rotacyjnym wymiennikiem\n"
        "- **AQUAREA VENT** (P-VEN*): prze\u0107iwpr\u0105dowe wymienniki, zakresy 15-45 kW\n"
        "- **PCZ-AHRP/STE**: jednostki i akcesoria AQUAREA VENT\n\n"
        "## Klimakonwektory (str. 15)\n"
        "- **P-FAL10/20/30/35/40SC/DC**: klimakonwektory 1/2-rurowe, jedno-/dwukanałowe\n"
        "- **PCZ-EEB/EFB/ECA/EWA...**: sterowniki i akcesoria klimakonwektorów\n",
        encoding="utf-8",
    )
    (knowledge / "pricing_usage_notes.md").write_text(
        "# Uwagi o cenach\n\n"
        "- Ceny sa hurtowymi cenami netto w PLN wg cennika Schiessl 03.2026.\n"
        "- Format PLN: separator tysiêcy = spacja, np. '9 720 z\u0142' = 9720 PLN.\n"
        "- Ceny zestaw\u00f3w KIT mog\u0105 by\u0107 cenami zestawu lub cen\u0105 jednostki kluczowej.\n"
        "- Rekordy bez ceny maj\u0105 `price_net: null` i `uncertainty_notes: price_not_found`.\n",
        encoding="utf-8",
    )

    # context layer
    (ctx / "offering" / "panasonic_offer_context.md").write_text(
        "# Panasonic offer context\n\n"
        "Dane do ofertowania: `data/normalized/products.jsonl` + `pricing_index.json`.\n"
        "Zestawy KIT-* sa podstawow\u0105 jednostk\u0105 ofertow\u0105 dla pomp ciep\u0142a.\n"
        "Zbiorniki, bufory, akcesoria z odpowiednich plik\u00f3w JSONL.\n",
        encoding="utf-8",
    )
    (ctx / "service" / "panasonic_service_context.md").write_text(
        "# Panasonic service context\n\n"
        "Serwis/cz\u0119\u015bci: kategorie controllers_thermostats, sensors_expansion_boards, hydraulic_accessories.\n"
        "Modele sterownik\u00f3w: CZ-RTW*, PAW-A2W-RTW*.\n"
        "Czujniki: PAW-A2W-TS*, PAW-TS*, CZ-TK*.\n",
        encoding="utf-8",
    )
    (ctx / "selection" / "panasonic_selection_context.md").write_text(
        "# Panasonic selection context\n\n"
        "Dobor pompy: generacja (K/L/M/J) + seria (T-CAP/High Performance/EcoFlex) + typ (split/AIO/monoblok) + moc kW + fazowo\u015b\u0107.\n"
        "Dobor zbiornika: obj\u0119to\u015b\u0107 (150-400 l), typ (nierdzewny/emaliowany/kombinowany).\n"
        "Dobor buforu: obj\u0119to\u015b\u0107 (50-300 l).\n"
        "Dobor komunikacji: WiFi (CZ-TAW1B), Modbus (PAW-AZAW-MBS*), KNX (PAW-AZAW-KNX*).\n",
        encoding="utf-8",
    )
    (ctx / "pricing" / "panasonic_pricing_context.md").write_text(
        "# Panasonic pricing context\n\n"
        "Podstawowe \u017ar\u00f3d\u0142o: `data/normalized/pricing_index.json` + `memory/facts/panasonic_pricing_facts.jsonl`.\n"
        "Waluta: PLN netto.\n"
        "Wersja cennika: Schiessl 03.2026.\n",
        encoding="utf-8",
    )
    (ctx / "llm" / "panasonic_llm_brief.md").write_text(
        "# Panasonic LLM brief\n\n"
        f"Cennik Schiessl/Panasonic 03.2026. {len(all_items)} rekord\u00f3w.\n"
        f"Kategorie: {', '.join(sorted(category_set))}.\n"
        "Dane strukturalne w `data/normalized/`. Kontekst per rodzina w `panasonic_context_packets.jsonl`.\n",
        encoding="utf-8",
    )
    rag_chunks = []
    for idx, r in enumerate(all_items, 1):
        txt = f"{r['model']} | {r['category']} | gen:{r['generation']} | {r['price_net']} PLN | {r['description_short'][:120]}"
        rag_chunks.append({
            "chunk_id": f"v2-{idx}",
            "source_doc": source_doc,
            "text": txt,
            "metadata": {"page": r["page"], "category": r["category"], "family": r["product_family"], "generation": r["generation"], "price_net": r["price_net"]},
        })
    write_jsonl(ctx / "llm" / "panasonic_rag_chunks.jsonl", rag_chunks)
    write_jsonl(ctx / "llm" / "panasonic_context_packets.jsonl", [
        {"packet_id": f"packet-{f['family']}", "family": f["family"],
         "models": f["models"][:80], "categories": f["categories"], "source_doc": source_doc}
        for f in families_out
    ])

    # QC snapshot
    qc = {
        "extractor_version": "2",
        "total_items": len(all_items),
        "missing_page_or_source": sum(1 for r in all_items if not r.get("page") or not r.get("source_doc")),
        "items_with_price": sum(1 for r in all_items if r["price_net"] is not None),
        "items_without_price": sum(1 for r in all_items if r["price_net"] is None),
        "heat_pumps_with_model": sum(1 for r in all_items if r["category"] == "heat_pumps" and r["model"]),
        "heat_pumps_missing_model": sum(1 for r in all_items if r["category"] == "heat_pumps" and not r["model"]),
        "unique_models": len(model_index),
        "categories": {k: v for k, v in sorted(cat_counts.items())},
        "generated_at": utc_now(),
    }
    write_json(reports / "panasonic_data_quality_summary.json", qc)
    print(json.dumps(qc, indent=2, ensure_ascii=False))


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--pdf", default=str(PDF_DEFAULT))
    args = p.parse_args()
    pdf = Path(args.pdf)
    if not pdf.is_absolute():
        pdf = ROOT / pdf
    run(pdf.resolve())


if __name__ == "__main__":
    main()

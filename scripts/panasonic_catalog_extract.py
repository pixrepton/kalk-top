#!/usr/bin/env python3
"""Panasonic catalog extraction pipeline (JSON-first).

Usage:
  python scripts/panasonic_catalog_extract.py --pdf panasonic/Panasonic_cennik_pompy_ciepla_03.2026.pdf
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_bytes_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ensure_dirs(paths: list[Path]) -> None:
    for p in paths:
        p.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def clean(s: Any) -> str:
    if s is None:
        return ""
    return re.sub(r"\s+", " ", str(s)).strip()


def detect_effective_date(text: str) -> str:
    for pat in (
        r"03\.2026",
        r"(\d{2}\.\d{4})",
        r"(\d{4}-\d{2})",
    ):
        m = re.search(pat, text)
        if m:
            return m.group(1) if m.groups() else m.group(0)
    return "2026-03 (inferred_from_filename)"


def category_from_text(text: str) -> tuple[str, str]:
    t = text.lower()
    rules = [
        ("heat_pumps", "aquarea", ["aquarea", "pompa ciepła", "t-cap", "split", "monoblok", "all in one"]),
        ("tanks", "dhw_tank", ["zbiornik", "zasobnik", "cwu"]),
        ("buffers", "buffer_tank", ["bufor"]),
        ("dhw_heat_pumps", "dhw", ["pompa cwu", "dhw heat pump"]),
        ("controllers_thermostats", "controls", ["termostat", "sterownik", "controller"]),
        ("sensors_expansion_boards", "sensors", ["czujnik", "sensor", "expansion board"]),
        ("hydraulic_accessories", "hydraulics", ["hydraul", "zawór", "pompa obiegowa"]),
        ("communication_modules", "connectivity", ["moduł komunik", "wifi", "modbus", "internet"]),
        ("ventilation", "rekuperacja", ["wentyl", "rekuper"]),
        ("fan_coils", "fancoil", ["fan coil", "klimakonwektor"]),
    ]
    for cat, sub, keys in rules:
        if any(k in t for k in keys):
            return cat, sub
    if "akces" in t:
        return "other_accessories", "accessories"
    return "other_accessories", "unclassified"


MODEL_PATTERNS = [
    r"\bKIT-[A-Z0-9\-]+\b",
    r"\bWH-[A-Z0-9\-]+\b",
    r"\bCU-[A-Z0-9\-]+\b",
    r"\bCZ-[A-Z0-9\-]+\b",
    r"\bPAW-[A-Z0-9\-]+\b",
]


def extract_models(text: str) -> list[str]:
    out: list[str] = []
    for pat in MODEL_PATTERNS:
        out.extend(re.findall(pat, text.upper()))
    return sorted(set(out))


def parse_price(text: str) -> float | None:
    m = re.search(r"(\d{1,3}(?:[\s.]\d{3})*(?:,\d{2})?)\s*(?:zł|pln)?", text.lower())
    if not m:
        return None
    num = m.group(1).replace(" ", "").replace(".", "").replace(",", ".")
    try:
        return float(num)
    except ValueError:
        return None


def guess_generation(text: str) -> str:
    t = text.upper()
    for g in ("M", "L", "K", "J", "H"):
        if f" GENERACJA {g}" in t or f" {g}-GEN" in t or f" SERIA {g}" in t:
            return g
    if "T-CAP" in t:
        return "K_or_L (inferred)"
    return "unknown"


def guess_phase(text: str) -> str:
    t = text.lower()
    if "3-faz" in t or "3f" in t or "3x" in t:
        return "3-phase"
    if "1-faz" in t or "1f" in t or "230v" in t:
        return "1-phase"
    return "unknown"


def guess_refrigerant(text: str) -> str:
    t = text.upper()
    if "R290" in t:
        return "R290"
    if "R32" in t:
        return "R32"
    if "R410A" in t:
        return "R410A"
    return "unknown"


@dataclass
class ExtractionState:
    source_doc: str
    source_vendor: str
    source_brand: str
    source_effective_date: str


def build_catalog_item(state: ExtractionState, page: int, section: str, text: str, row: list[str], idx: int) -> dict[str, Any]:
    row_text = clean(" | ".join(row))
    combined = clean(text + " " + row_text)
    models = extract_models(combined)
    model = models[0] if models else ""
    category, subcategory = category_from_text(combined)
    price_net = parse_price(row_text) or parse_price(combined)
    generation = guess_generation(combined)
    extraction_confidence = 0.9 if model else 0.45

    return {
        "id": f"panasonic-2026-{page}-{idx}",
        "source_doc": state.source_doc,
        "source_vendor": state.source_vendor,
        "source_brand": state.source_brand,
        "source_effective_date": state.source_effective_date,
        "page": page,
        "section": section,
        "subsection": "",
        "category": category,
        "subcategory": subcategory,
        "product_family": "Aquarea" if "aquarea" in combined.lower() else "",
        "series": "T-CAP" if "t-cap" in combined.lower() else "",
        "generation": generation,
        "product_name": clean(row[0]) if row else clean(combined[:120]),
        "model": model,
        "sku_or_catalog_code": model,
        "description_short": clean(combined[:240]),
        "phase": guess_phase(combined),
        "refrigerant": guess_refrigerant(combined),
        "unit_type": "indoor_outdoor_set" if "kit-" in combined.lower() else "",
        "indoor_unit": "",
        "outdoor_unit": "",
        "tank_volume_l": None,
        "buffer_volume_l": None,
        "heater_kw": None,
        "power_kw": None,
        "price_net": price_net,
        "bundle_price_net": price_net,
        "currency": "PLN",
        "includes_wifi": "wifi" in combined.lower(),
        "notes": "",
        "extraction_confidence": extraction_confidence,
        "uncertainty_notes": "" if model else "model_not_found_in_row",
        "source_text_fragment": combined[:500],
        "category_specific": {},
    }


def run(pdf_path: Path) -> None:
    data_raw = ROOT / "data" / "raw"
    data_norm = ROOT / "data" / "normalized"
    memory_entities = ROOT / "memory" / "entities"
    memory_relations = ROOT / "memory" / "relations"
    memory_facts = ROOT / "memory" / "facts"
    knowledge = ROOT / "knowledge" / "panasonic"
    context = ROOT / "context"
    reports = ROOT / "reports"
    ensure_dirs(
        [
            data_raw,
            data_norm,
            memory_entities,
            memory_relations,
            memory_facts,
            knowledge,
            context / "offering",
            context / "service",
            context / "selection",
            context / "pricing",
            context / "llm",
            reports,
        ]
    )

    state = ExtractionState(
        source_doc=pdf_path.name,
        source_vendor="Schiessl",
        source_brand="Panasonic",
        source_effective_date="unknown",
    )

    pages_records: list[dict[str, Any]] = []
    table_records: list[dict[str, Any]] = []
    catalog_items: list[dict[str, Any]] = []
    section_set: set[str] = set()
    category_set: set[str] = set()

    with pdfplumber.open(str(pdf_path)) as pdf:
        full_text = ""
        for i, page in enumerate(pdf.pages, start=1):
            text = clean(page.extract_text() or "")
            full_text += "\n" + text
            section, _ = category_from_text(text)
            section_set.add(section)
            tables = page.extract_tables() or []
            page_title_guess = clean(text.split(" ")[0:12]) if text else f"page_{i}"
            pages_records.append(
                {
                    "page": i,
                    "page_title_guess": page_title_guess,
                    "section_guess": section,
                    "raw_text": text,
                    "table_presence": bool(tables),
                    "image_heavy": len(text) < 120,
                    "extraction_notes": "" if text else "low_text_density",
                }
            )

            if not tables and text:
                # Fallback line-based pseudo-table for text pages.
                lines = [ln for ln in text.split(" ") if ln]
                if lines:
                    pseudo = [lines[: min(12, len(lines))]]
                    tables = [pseudo]

            row_id = 0
            for t_idx, table in enumerate(tables):
                if not table:
                    continue
                table_records.append(
                    {
                        "source_doc": pdf_path.name,
                        "page": i,
                        "table_index": t_idx,
                        "rows": [[clean(c) for c in (r or [])] for r in table],
                        "section_guess": section,
                    }
                )
                for row in table:
                    row = [clean(c) for c in (row or []) if clean(c)]
                    if not row:
                        continue
                    item = build_catalog_item(state, i, section, text, row, row_id)
                    row_id += 1
                    if item["price_net"] is None and item["model"] == "":
                        continue
                    category_set.add(item["category"])
                    catalog_items.append(item)

        state.source_effective_date = detect_effective_date(full_text + " " + pdf_path.name)
        for item in catalog_items:
            item["source_effective_date"] = state.source_effective_date

        manifest = {
            "file_name": pdf_path.name,
            "file_hash": read_bytes_hash(pdf_path),
            "effective_date": state.source_effective_date,
            "source_vendor": state.source_vendor,
            "source_brand": state.source_brand,
            "total_pages": len(pdf.pages),
            "detected_sections": sorted(section_set),
            "detected_categories": sorted(category_set),
            "extraction_method": "pdfplumber_text_and_tables",
            "extraction_timestamp": utc_now(),
        }

    # Raw layer
    write_json(data_raw / "panasonic_2026_pdf_manifest.json", manifest)
    write_jsonl(data_raw / "panasonic_2026_pages.jsonl", pages_records)
    write_json(
        data_raw / "panasonic_2026_sections.json",
        {
            "source_doc": pdf_path.name,
            "sections": sorted(section_set),
            "categories": sorted(category_set),
        },
    )
    write_jsonl(data_raw / "panasonic_2026_tables.jsonl", table_records)

    # Normalized layer
    write_jsonl(data_norm / "catalog_items.jsonl", catalog_items)
    products = [r for r in catalog_items if r["category"] == "heat_pumps"]
    accessories = [
        r
        for r in catalog_items
        if r["category"]
        in {"controllers_thermostats", "sensors_expansion_boards", "hydraulic_accessories", "communication_modules", "other_accessories"}
    ]
    tanks_buffers = [r for r in catalog_items if r["category"] in {"tanks", "buffers", "dhw_heat_pumps"}]
    vent_fan = [r for r in catalog_items if r["category"] in {"ventilation", "fan_coils"}]
    write_jsonl(data_norm / "products.jsonl", products)
    write_jsonl(data_norm / "accessories.jsonl", accessories)
    write_jsonl(data_norm / "tanks_buffers.jsonl", tanks_buffers)
    write_jsonl(data_norm / "ventilation_and_fancoils.jsonl", vent_fan)

    families: dict[str, dict[str, Any]] = {}
    model_index: dict[str, dict[str, Any]] = {}
    pricing_index: dict[str, Any] = {}
    compatibility: dict[str, Any] = {"indoor_outdoor": [], "series_links": []}
    generation_index: dict[str, list[str]] = {}
    for rec in catalog_items:
        fam = rec["product_family"] or "unknown_family"
        families.setdefault(
            fam,
            {"family": fam, "categories": set(), "models": set(), "generations": set()},
        )
        families[fam]["categories"].add(rec["category"])
        if rec["model"]:
            families[fam]["models"].add(rec["model"])
        if rec["generation"] != "unknown":
            families[fam]["generations"].add(rec["generation"])
        if rec["model"]:
            model_index[rec["model"]] = {
                "model": rec["model"],
                "category": rec["category"],
                "family": fam,
                "generation": rec["generation"],
                "page": rec["page"],
                "price_net": rec["price_net"],
                "source_doc": rec["source_doc"],
            }
            pricing_index[rec["model"]] = {
                "price_net": rec["price_net"],
                "currency": rec["currency"],
                "page": rec["page"],
            }
            generation_index.setdefault(rec["generation"], []).append(rec["model"])

    families_out = []
    for k, v in families.items():
        families_out.append(
            {
                "family": k,
                "categories": sorted(v["categories"]),
                "models": sorted(v["models"]),
                "generations": sorted(v["generations"]),
            }
        )
    write_json(data_norm / "product_families.json", {"families": families_out})
    write_json(data_norm / "generation_index.json", generation_index)
    write_json(data_norm / "model_index.json", model_index)
    write_json(data_norm / "compatibility_map.json", compatibility)
    write_json(data_norm / "pricing_index.json", pricing_index)

    # Memory layer
    write_json(memory_entities / "panasonic_product_families.json", {"families": families_out})
    write_json(memory_entities / "panasonic_model_index.json", model_index)
    write_json(
        memory_entities / "panasonic_category_map.json",
        {
            "heat_pumps": "glowne pompy ciepla",
            "tanks": "zasobniki CWU",
            "buffers": "bufory instalacyjne",
            "dhw_heat_pumps": "pompy CWU",
            "controllers_thermostats": "sterowanie",
            "sensors_expansion_boards": "czujniki i rozszerzenia",
            "hydraulic_accessories": "hydraulika",
            "communication_modules": "komunikacja",
            "other_accessories": "pozostale akcesoria",
            "ventilation": "rekuperacja",
            "fan_coils": "klimakonwektory",
        },
    )
    write_json(memory_relations / "panasonic_indoor_outdoor_links.json", compatibility)
    write_json(
        memory_relations / "panasonic_generation_family_links.json",
        {"generation_index": generation_index, "families": families_out},
    )
    write_jsonl(
        memory_facts / "panasonic_pricing_facts.jsonl",
        [
            {
                "fact_type": "price",
                "model": r["model"],
                "price_net": r["price_net"],
                "currency": r["currency"],
                "source_doc": r["source_doc"],
                "page": r["page"],
            }
            for r in catalog_items
            if r["model"] and r["price_net"] is not None
        ],
    )
    write_jsonl(
        memory_facts / "panasonic_compatibility_facts.jsonl",
        [
            {
                "fact_type": "compatibility",
                "model": r["model"],
                "family": r["product_family"],
                "series": r["series"],
                "generation": r["generation"],
                "uncertainty": "no_explicit_pairing_detected",
            }
            for r in products
            if r["model"]
        ],
    )
    write_json(
        memory_facts / "panasonic_naming_rules.json",
        {
            "rules": [
                "KIT-* traktowane jako zestawy jednostek",
                "WH-* oraz CU-* traktowane jako jednostki / komponenty",
                "CZ-* i PAW-* zwykle akcesoria/sterowanie/komunikacja",
            ],
            "confidence": "medium",
        },
    )

    # Knowledge + context (derived from normalized)
    (knowledge / "catalog_overview.md").write_text(
        f"# Panasonic katalog overview (03.2026)\n\n"
        f"- Source: `{pdf_path.name}`\n"
        f"- Total pages: {manifest['total_pages']}\n"
        f"- Extracted catalog items: {len(catalog_items)}\n"
        f"- Detected categories: {', '.join(sorted(category_set))}\n",
        encoding="utf-8",
    )
    (knowledge / "aquarea_families.md").write_text("# Aquarea families\n\nDerived from `product_families.json`.\n", encoding="utf-8")
    (knowledge / "generations_guide.md").write_text("# Generations guide\n\nK/L/M/J generations are inferred from model/section text when present.\n", encoding="utf-8")
    (knowledge / "product_categories_guide.md").write_text("# Product categories guide\n\nCategory model follows canonical schema categories.\n", encoding="utf-8")
    (knowledge / "accessories_and_controls.md").write_text("# Accessories and controls\n\nBuilt from `accessories.jsonl`.\n", encoding="utf-8")
    (knowledge / "tanks_buffers_and_dhw.md").write_text("# Tanks, buffers and DHW\n\nBuilt from `tanks_buffers.jsonl`.\n", encoding="utf-8")
    (knowledge / "ventilation_and_fancoils.md").write_text("# Ventilation and fan coils\n\nBuilt from `ventilation_and_fancoils.jsonl`.\n", encoding="utf-8")
    (knowledge / "pricing_usage_notes.md").write_text(
        "# Pricing usage notes\n\n"
        "- Prices are interpreted as net wholesale list prices when parseable.\n"
        "- Missing prices remain null and are flagged by validation reports.\n",
        encoding="utf-8",
    )

    (context / "offering" / "panasonic_offer_context.md").write_text("# Panasonic offer context\nUse `products.jsonl` + `pricing_index.json` for offer building.\n", encoding="utf-8")
    (context / "service" / "panasonic_service_context.md").write_text("# Panasonic service context\nUse accessory/controller model records for service references.\n", encoding="utf-8")
    (context / "selection" / "panasonic_selection_context.md").write_text("# Panasonic selection context\nUse category/family/generation and model index for selection.\n", encoding="utf-8")
    (context / "pricing" / "panasonic_pricing_context.md").write_text("# Panasonic pricing context\nPrimary source is `pricing_index.json` + pricing facts.\n", encoding="utf-8")
    (context / "llm" / "panasonic_llm_brief.md").write_text("# Panasonic LLM brief\nThis context is generated from normalized Panasonic catalog artifacts.\n", encoding="utf-8")
    write_jsonl(
        context / "llm" / "panasonic_rag_chunks.jsonl",
        [
            {
                "chunk_id": f"cat-{i}",
                "source_doc": pdf_path.name,
                "text": f"{r['model']} | {r['category']} | {r['description_short']}",
                "metadata": {"page": r["page"], "family": r["product_family"], "generation": r["generation"]},
            }
            for i, r in enumerate(catalog_items[:200], start=1)
        ],
    )
    write_jsonl(
        context / "llm" / "panasonic_context_packets.jsonl",
        [
            {
                "packet_id": f"packet-{f['family']}",
                "family": f["family"],
                "models": f["models"][:50],
                "categories": f["categories"],
                "source_doc": pdf_path.name,
            }
            for f in families_out
        ],
    )

    # Quality report seed
    missing_page_or_source = sum(1 for r in catalog_items if not r.get("page") or not r.get("source_doc"))
    duplicate_models = len([m for m in model_index.keys() if list(model_index.keys()).count(m) > 1])
    qc = {
        "total_items": len(catalog_items),
        "missing_page_or_source": missing_page_or_source,
        "duplicate_model_count": duplicate_models,
        "null_price_items": sum(1 for r in catalog_items if r["price_net"] is None),
        "generated_at": utc_now(),
    }
    write_json(reports / "panasonic_data_quality_summary.json", qc)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True, help="Path to Panasonic PDF")
    args = parser.parse_args()
    pdf_path = (ROOT / args.pdf).resolve() if not Path(args.pdf).is_absolute() else Path(args.pdf)
    run(pdf_path)


if __name__ == "__main__":
    main()

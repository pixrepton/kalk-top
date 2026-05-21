# Panasonic Pass 2 — Repair Summary

## What was wrong in pass 1

- **Category coverage was severely limited**: only `heat_pumps` and `other_accessories` were detected (all 11 required categories were not populated).
- **39 heat pump records had no model code**: the pass-1 extractor used a generic line-based fallback for text pages and didn't properly process 5-column heat-pump tables.
- **All prices were matched via the same heuristic**: the generic `parse_price()` regex worked on concatenated text strings, not on the actual word-level spatial layout, so prices were either wrong or missing.
- **Tanks, buffers, DHW heat pumps, controllers, sensors, hydraulics, communication, ventilation and fan coils**: produced 0 records or landed incorrectly in `other_accessories`.
- The normalized layer was NOT usable as a canonical base for TOP-INSTAL applications.

## What was fixed in pass 2

### 1. Full page audit

- Ran `panasonic_page_audit.py` and `panasonic_table_deep_dump.py` to map table structure per page.
- Confirmed layout: pages 2-8 (heat pumps), 9-10 (tanks), 11 (buffers + DHW), 12-13 (controllers + accessories + communication), 14 (ventilation), 15 (fan coils).

### 2. Profile-based extractor (`panasonic_catalog_extract_v2.py`)

- **`detect_section_profile(page_num)`**: maps each page to its domain category.
- **`extract_heat_pump_records(...)`**: parses 5-column tables `[kit/desc, power_kW, indoor_model, heater_kW, outdoor_model]` for pages 2-8; also handles 1-column monoblok rows (pages 7-8).
- **`extract_single_col_records(...)`**: handles pages 9-15 with single-column model-code tables and multi-column header rows (pages 12-13).
- **`subcategory(model)`**: 30+ model-code prefix rules to assign subcategory and refine category.
- **`guess_generation/series/phase/refrigerant(text, model)`**: infer generation (K/L/M/J), series (T-CAP/High Performance), phase (1/3), refrigerant (R290/R32) from section headers and model codes.

### 3. Coordinate-based price matching

- **`reconstruct_prices_from_words(words)`**: groups words by y-bucket (±3px), scans for numeric sequences. Gap threshold: 40px for 1-digit thousands prefix (catches "6 192" → 6192 PLN), 18px for 2+ digit prefixes. Single-token kW values (3,5,6,7,9,12…) filtered; multi-token sequences always treated as prices.
- **`find_price_for_model(model_x0, model_y, prices, min_price)`**: finds nearest price to the right of model, at ±10px y-tolerance (with fallback 3× wider). Per-model `min_price` thresholds prevent capacity/volume numbers (200 l, 300 l) from being misinterpreted as prices.
- **`min_price_for_model(model)`**: tanks ≥ 2000, buffers ≥ 1500, DHW ≥ 5000, kits/monobloks ≥ 5000, accessories ≥ 200 PLN.

### 4. Bug fixed: indentation error in `extract_single_col_records`

- `records.append(...)` was accidentally nested inside the `for w in word_by_text...` loop instead of appearing after it. This caused all tank/buffer/DHW/ventilation/fan-coil records to produce 0 items when the model was not in the word layer.

### 5. Indoor/outdoor compatibility map

- KIT-type heat pump records now write `indoor_unit`, `outdoor_unit`, and `kit_model` to `compatibility_map.json` → `indoor_outdoor` list.

## Category coverage before vs after

| Category                 | Pass 1 records           | Pass 2 records                      |
| ------------------------ | ------------------------ | ----------------------------------- |
| heat_pumps               | 197 (many without model) | 77 (all with model, all with price) |
| tanks                    | 0                        | 14                                  |
| buffers                  | 0                        | 9                                   |
| dhw_heat_pumps           | 0                        | 4                                   |
| controllers_thermostats  | 0                        | 8                                   |
| sensors_expansion_boards | 0                        | 21                                  |
| hydraulic_accessories    | 0                        | 9                                   |
| communication_modules    | 0                        | 12                                  |
| other_accessories        | 39                       | 0                                   |
| ventilation              | 0                        | 44                                  |
| fan_coils                | 0                        | 39                                  |
| **Total**                | **236**                  | **237**                             |

## Model completeness before vs after

- heat_pumps missing model: **39 → 0**
- Items with price: **0 → 235** (2 remain null — edge cases in accessories)
- Items without price: **236 → 2**
- Schema errors: **0 → 0** (both passes)
- Missing page/source: **0 → 0** (both passes)

## Heuristics added

- Section profile detection by page number.
- 5-column heat pump table parser with indoor/outdoor/kit extraction.
- Polish thousands-separator price reconstruction with configurable gap threshold.
- Per-category minimum price thresholds to exclude volume/capacity numbers.
- Model-code prefix → subcategory mapping (30+ rules).
- Generation/series/phase/refrigerant inference from section headers and model codes.
- KIT indoor/outdoor compatibility link builder.

## Golden test set

- 41 records across all 10 required categories.
- Verified by coordinate-based spatial evidence (model word y matches price word y).
- All 41 pass; run: `python tests/fixtures/panasonic_catalog_golden_test.py`

## Is the result ready as canonical base for TOP-INSTAL?

**YES, with the following known remaining gaps:**

1. **2 accessories with null price** — edge cases in multi-col accessory tables where the word layer does not contain the model code (model appears only in table cells, not in the text word layer). Acceptable for accessory reference; prices are available on-demand from the raw tables layer.
2. **`compatibility_map.json` indoor/outdoor links are populated for KIT records only** — explicit per-model pairing tables (which combination of indoor+outdoor units is valid) are not present in the price list; they require a separate product compatibility source.
3. **Generation detection is heuristic** — based on section text and model code suffix patterns. Reliable for K/L/M/J splits, but models shared across sections may inherit the section's generation.
4. **Dual-column page layout for tanks (pages 9-10)** — price matching is spatial (y-row proximity). Verified correct for all tested cases; new PDF versions should re-validate if layout changes.

The normalized layer NOW covers all required product domains and passes both schema validation and the 41-record golden test.

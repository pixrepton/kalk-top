# Panasonic Extraction QC

## Source

- File: `panasonic/Panasonic_cennik_pompy_ciepla_03.2026.pdf`
- Hash: `fd6ac8a3ce484a78837cd30e9d6e911fef9c77d3f7fb228081f5635e7b3ae4b7`
- Pages: 16 total (2-15 extracted, 1 = cover, 16 = footer)
- Extractor version: **v2** (`panasonic_catalog_extract_v2.py`)

## Checks

| Check                                        | Result                        |
| -------------------------------------------- | ----------------------------- |
| All pages represented in `pages.jsonl`       | PASS (16/16)                  |
| Section/category detection                   | PASS (10 categories detected) |
| Table extraction (`tables.jsonl`)            | PASS                          |
| Source provenance (`source_doc`, `page`)     | PASS (0 missing)              |
| Schema validation (`schema_validation.json`) | PASS (0 errors)               |
| Heat pumps with model                        | PASS (77/77)                  |
| Heat pumps missing model                     | PASS (0)                      |
| Items with price                             | 235/237                       |
| Items without price                          | 2 (accessories edge case)     |
| Golden test (41 records)                     | **PASS (41/41)**              |
| Quality gates                                | **ALL PASS**                  |

## Result snapshot (v2)

| Metric                   | Value                                                  |
| ------------------------ | ------------------------------------------------------ |
| Total catalog items      | 237                                                    |
| Missing page/source      | 0                                                      |
| Schema errors            | 0                                                      |
| Items with price         | 235                                                    |
| Items without price      | 2                                                      |
| Heat pumps missing model | 0                                                      |
| Unique models            | 234                                                    |
| Category coverage        | 10/11 (no `other_accessories` — all were reclassified) |
| Golden test              | 41/41                                                  |

## Category breakdown

| Category                 | Count |
| ------------------------ | ----- |
| heat_pumps               | 77    |
| tanks                    | 14    |
| buffers                  | 9     |
| dhw_heat_pumps           | 4     |
| controllers_thermostats  | 8     |
| sensors_expansion_boards | 21    |
| hydraulic_accessories    | 9     |
| communication_modules    | 12    |
| ventilation              | 44    |
| fan_coils                | 39    |

## Remaining uncertainties

- 2 accessories have `price_net: null` (model exists in table but not in word layer; price lookup could not match).
- Indoor/outdoor compatibility links populated only for KIT-type records.
- Generation inference is heuristic (section text + model code suffix).

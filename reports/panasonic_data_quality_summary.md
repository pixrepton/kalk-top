# Panasonic Data Quality Summary

## Source

- `Panasonic_cennik_pompy_ciepla_03.2026.pdf`
- Effective date: `03.2026`
- Vendor: Schiessl
- Extractor version: **v2** (profiled, coordinate-based)

## Quality metrics

| Metric                   | Pass 1 | Pass 2 |
| ------------------------ | ------ | ------ |
| Total records            | 236    | 237    |
| Schema errors            | 0      | 0      |
| Missing page/source      | 0      | 0      |
| Items with price         | 0      | 235    |
| Items without price      | 236    | 2      |
| Heat pumps missing model | 39     | 0      |
| Unique models            | —      | 234    |
| Category coverage        | 2/11   | 10/11  |
| Golden test pass rate    | N/A    | 41/41  |

## Assessment

**Pass 2 normalized layer is usable as canonical base** for TOP-INSTAL calculators, offer generators, and LLM agents.

- Provenance integrity: strong (`page` + `source_doc` on all records)
- Price coverage: 99.2% (235/237)
- Model completeness for heat pumps: 100%
- Category coverage: all 10 required domains populated
- Schema compliance: full

## Known gaps

1. 2 accessories without price (edge case; model in table only, not word layer).
2. `other_accessories` category has 0 records — all items reclassified to more specific categories (sensors, controllers, communication, hydraulics). This is intentional and correct.
3. Indoor/outdoor compatibility explicit pairing requires a separate compatibility catalog.

# Panasonic Schema Validation

## Extractor version: v2

- Validated items: 237
- Schema errors: 0
- Missing page/source: 0
- Missing model for heat_pumps: 0
- Golden test: **41/41 PASS**

All records conform to `schemas/panasonic_catalog_item.schema.json`.

## How to re-validate

```powershell
python scripts/panasonic_catalog_validate.py
python tests/fixtures/panasonic_catalog_golden_test.py
```

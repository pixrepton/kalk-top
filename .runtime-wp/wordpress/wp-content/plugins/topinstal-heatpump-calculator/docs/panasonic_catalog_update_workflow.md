# Panasonic Catalog Update Workflow

## 1. Replace source PDF

1. Put new PDF into `panasonic/`.
2. Keep filename stable if possible (or pass explicit path to scripts).

## 2. Run pipeline

Use the v2 profiled extractor (production):

```powershell
python scripts/panasonic_catalog_extract_v2.py --pdf "panasonic/<NEW_FILE>.pdf"
python scripts/panasonic_catalog_validate.py
python tests/fixtures/panasonic_catalog_golden_test.py
```

`panasonic_catalog_extract.py` (v1) is kept for reference only. Do not use it for production runs — it does not do per-section profiling or coordinate-based price matching, and will produce incorrect category coverage and null prices for most categories.

## 3. Compare with previous snapshot

If you have previous pricing index:

```powershell
python scripts/panasonic_catalog_compare.py --old "path/to/previous/pricing_index.json" --new "data/normalized/pricing_index.json"
```

If you do not have previous snapshot, run baseline mode:

```powershell
python scripts/panasonic_catalog_compare.py
```

## 4. Review outputs

- Raw layer: `data/raw/*`
- Normalized layer: `data/normalized/*`
- Memory layer: `memory/entities/*`, `memory/relations/*`, `memory/facts/*`
- Knowledge layer: `knowledge/panasonic/*`
- Context layer: `context/*/panasonic_*`
- Reports: `reports/panasonic_*`

## 5. Detect changes

Use `reports/panasonic_changes_vs_previous.md` to inspect:

- new models,
- removed models,
- price deltas.

## 6. Refresh downstream consumers

Update integrations that consume:

- `data/normalized/pricing_index.json`
- `data/normalized/model_index.json`
- `context/llm/panasonic_context_packets.jsonl`
- `context/llm/panasonic_rag_chunks.jsonl`

## 7. Changelog discipline

For each update keep:

- source PDF name and hash,
- extraction timestamp,
- validation summary,
- diff report link.

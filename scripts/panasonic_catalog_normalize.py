#!/usr/bin/env python3
"""Wrapper for Panasonic normalization stage.

Current implementation runs the extraction pipeline end-to-end (JSON-first),
which already emits normalized artifacts.
"""

from pathlib import Path
import argparse
from panasonic_catalog_extract import run


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--pdf", required=True)
    args = p.parse_args()
    pdf = Path(args.pdf)
    run(pdf if pdf.is_absolute() else Path(__file__).resolve().parents[1] / pdf)


if __name__ == "__main__":
    main()

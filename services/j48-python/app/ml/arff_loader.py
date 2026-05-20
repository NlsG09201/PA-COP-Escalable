from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import pandas as pd


def load_arff(path: str | Path) -> tuple[pd.DataFrame, list[str], list[str]]:
    """Parse Weka ARFF into a pandas DataFrame with nominal columns as strings."""
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    lines = [ln.strip() for ln in text.splitlines() if ln.strip() and not ln.strip().startswith("%")]

    attributes: list[tuple[str, str]] = []
    data_started = False
    rows: list[list[str]] = []

    for line in lines:
        if line.upper().startswith("@RELATION"):
            continue
        if line.upper().startswith("@ATTRIBUTE"):
            m = re.match(r"@ATTRIBUTE\s+(\S+)\s+(.+)", line, re.I)
            if not m:
                continue
            name, rest = m.group(1), m.group(2).strip()
            if rest.startswith("{"):
                attributes.append((name, "nominal"))
            else:
                attributes.append((name, "numeric"))
            continue
        if line.upper().startswith("@DATA"):
            data_started = True
            continue
        if data_started:
            rows.append([c.strip() for c in line.split(",")])

    if not attributes or not rows:
        raise ValueError(f"ARFF inválido o vacío: {path}")

    col_names = [a[0] for a in attributes]
    df = pd.DataFrame(rows, columns=col_names)

    numeric_cols = [name for name, kind in attributes if kind == "numeric"]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    class_col = col_names[-1]
    feature_cols = col_names[:-1]
    return df, feature_cols, [class_col]

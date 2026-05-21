from __future__ import annotations

import io
import re
from pathlib import Path

import pandas as pd

from app.ml.arff_loader import load_arff


def load_csv_bytes(content: bytes, filename: str) -> tuple[pd.DataFrame, list[str], str]:
    text = content.decode("utf-8", errors="replace")
    sep = ";" if text.count(";") > text.count(",") else ","
    df = pd.read_csv(io.StringIO(text), sep=sep)
    df.columns = [str(c).strip() for c in df.columns]
    if df.empty or len(df.columns) < 2:
        raise ValueError(f"CSV inválido o vacío: {filename}")
    feature_cols = list(df.columns[:-1])
    target_col = str(df.columns[-1])
    return df, feature_cols, target_col


def load_dataset_file(path: Path) -> tuple[pd.DataFrame, list[str], str]:
    suffix = path.suffix.lower()
    if suffix == ".arff":
        df, feature_cols, class_cols = load_arff(path)
        return df, feature_cols, class_cols[0]
    if suffix == ".csv":
        raw = path.read_bytes()
        return load_csv_bytes(raw, path.name)
    raise ValueError(f"Formato no soportado: {suffix}")


def infer_column_types(df: pd.DataFrame, feature_cols: list[str]) -> dict[str, str]:
    types: dict[str, str] = {}
    for col in feature_cols:
        if col not in df.columns:
            continue
        series = df[col]
        if pd.api.types.is_numeric_dtype(series):
            types[col] = "numeric"
        else:
            types[col] = "nominal"
    return types


def dataset_preview(df: pd.DataFrame, limit: int = 8) -> list[dict]:
    sample = df.head(limit).copy()
    for col in sample.columns:
        if pd.api.types.is_numeric_dtype(sample[col]):
            continue
        sample[col] = sample[col].astype(str)
    return sample.to_dict(orient="records")


def column_stats(df: pd.DataFrame) -> list[dict]:
    cols: list[dict] = []
    for name in df.columns:
        series = df[name]
        entry: dict = {
            "name": name,
            "dtype": str(series.dtype),
            "missing": int(series.isna().sum()),
            "unique": int(series.nunique(dropna=True)),
        }
        if pd.api.types.is_numeric_dtype(series):
            entry["min"] = float(series.min()) if series.notna().any() else None
            entry["max"] = float(series.max()) if series.notna().any() else None
        else:
            top = series.astype(str).value_counts().head(5)
            entry["topValues"] = {str(k): int(v) for k, v in top.items()}
        cols.append(entry)
    return cols

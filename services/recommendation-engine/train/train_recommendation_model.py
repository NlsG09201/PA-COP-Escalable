"""
Training pipeline for the clinical-recommendation ranking model.

Loads clinical history and treatment outcomes from PostgreSQL + MongoDB,
engineers features, trains a GradientBoostingClassifier for recommendation
category prediction, evaluates with cross-validation, and exports via joblib.

Usage:
    python -m train.train_recommendation_model
    RECO_POSTGRES_URL=... python -m train.train_recommendation_model
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import GridSearchCV, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("train_recommendation_model")

POSTGRES_URL: str = os.getenv("RECO_POSTGRES_URL", "postgresql://cop:cop_dev_password_change_me@localhost:5432/cop")
MONGODB_URI: str = os.getenv("RECO_MONGODB_URI", "mongodb://cop:cop_dev_password_change_me@localhost:27017/cop?authSource=admin")
MONGODB_DB: str = os.getenv("RECO_MONGODB_DB", "cop")
OUTPUT_PATH: str = os.getenv("RECO_RECOMMENDATION_MODEL_PATH", "app/ml/weights/recommendation_model.joblib")

CATEGORY_MAP: dict[str, int] = {
    "restorative": 0,
    "periodontal": 1,
    "orthodontic": 2,
    "surgical": 3,
    "psychotherapy": 4,
    "behavioral": 5,
    "substance_use": 6,
    "medication_management": 7,
    "crisis": 8,
    "preventive": 9,
}

FEATURE_COLS = [
    "num_entries",
    "num_conditions",
    "specialty_flag",
    "type_feat_1",
    "type_feat_2",
    "type_feat_3",
    "has_surgical",
    "has_chronic",
    "avg_outcome_score",
    "treatment_duration_days",
]


# ── Data loading ─────────────────────────────────────────────────────────────

def _load_pg_clinical_history(conn) -> pd.DataFrame:  # noqa: ANN001
    query = """
        SELECT
            ch.patient_id,
            ch.entry_date,
            ch.entry_type,
            ch.description,
            ch.specialty,
            COALESCE(to2.outcome_score, 0) AS outcome_score,
            COALESCE(to2.recommended_category, 'preventive') AS recommended_category,
            COALESCE(to2.treatment_duration_days, 0) AS treatment_duration_days
        FROM clinical_history ch
        LEFT JOIN treatment_outcomes to2 ON ch.patient_id = to2.patient_id
            AND ch.entry_date = to2.entry_date
        ORDER BY ch.patient_id, ch.entry_date
    """
    return pd.read_sql(query, conn)


def _load_mongo_outcomes() -> pd.DataFrame:
    try:
        from pymongo import MongoClient

        client = MongoClient(MONGODB_URI)
        db = client[MONGODB_DB]
        docs = list(db["treatment_outcomes"].find({}, {"_id": 0}))
        client.close()
        if docs:
            return pd.DataFrame(docs)
    except Exception:
        logger.warning("Could not load MongoDB treatment outcomes", exc_info=True)
    return pd.DataFrame()


# ── Feature engineering ──────────────────────────────────────────────────────

def _engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    records: list[dict] = []
    grouped = df.groupby("patient_id")

    for pid, group in grouped:
        num_entries = len(group)
        conditions = group["description"].str.lower().tolist()
        num_conditions = len(set(conditions))

        specialty_vals = group["specialty"].str.upper().unique()
        specialty_flag = 1.0 if "ODONTOLOGY" in specialty_vals else 0.0

        type_counts = group["entry_type"].value_counts()
        top_types = type_counts.values.tolist()
        type_feat_1 = float(top_types[0]) if len(top_types) > 0 else 0.0
        type_feat_2 = float(top_types[1]) if len(top_types) > 1 else 0.0
        type_feat_3 = float(top_types[2]) if len(top_types) > 2 else 0.0

        has_surgical = 1.0 if any("surg" in c or "extract" in c for c in conditions) else 0.0
        has_chronic = 1.0 if any(kw in " ".join(conditions) for kw in ["chronic", "recurrent", "persistent"]) else 0.0

        avg_outcome_score = float(group["outcome_score"].mean())
        treatment_duration_days = float(group["treatment_duration_days"].mean())

        category_mode = group["recommended_category"].mode()
        label = category_mode.iloc[0] if not category_mode.empty else "preventive"

        records.append({
            "patient_id": pid,
            "num_entries": float(num_entries),
            "num_conditions": float(num_conditions),
            "specialty_flag": specialty_flag,
            "type_feat_1": type_feat_1,
            "type_feat_2": type_feat_2,
            "type_feat_3": type_feat_3,
            "has_surgical": has_surgical,
            "has_chronic": has_chronic,
            "avg_outcome_score": avg_outcome_score,
            "treatment_duration_days": treatment_duration_days,
            "label": label,
        })

    return pd.DataFrame(records)


# ── Synthetic fallback ───────────────────────────────────────────────────────

def _generate_synthetic_data(n: int = 800) -> tuple[pd.DataFrame, pd.Series]:
    rng = np.random.RandomState(123)
    n_classes = len(CATEGORY_MAP)

    data = pd.DataFrame({
        "num_entries": rng.randint(1, 30, n).astype(float),
        "num_conditions": rng.randint(1, 10, n).astype(float),
        "specialty_flag": rng.choice([0.0, 1.0], n),
        "type_feat_1": rng.uniform(0, 15, n),
        "type_feat_2": rng.uniform(0, 10, n),
        "type_feat_3": rng.uniform(0, 5, n),
        "has_surgical": rng.choice([0.0, 1.0], n, p=[0.7, 0.3]),
        "has_chronic": rng.choice([0.0, 1.0], n, p=[0.6, 0.4]),
        "avg_outcome_score": rng.uniform(0.0, 10.0, n),
        "treatment_duration_days": rng.uniform(1, 365, n),
    })

    y = rng.randint(0, n_classes, n)
    y = np.where((data["specialty_flag"] == 1.0) & (data["has_surgical"] == 1.0), 3, y)
    y = np.where((data["specialty_flag"] == 0.0) & (data["has_chronic"] == 1.0), 4, y)
    y = np.where(
        (data["specialty_flag"] == 1.0) & (data["avg_outcome_score"] < 3),
        0,
        y,
    )

    return data, pd.Series(y, name="label")


# ── Training ─────────────────────────────────────────────────────────────────

def train() -> None:
    X: pd.DataFrame
    y: pd.Series

    try:
        import psycopg2

        conn = psycopg2.connect(POSTGRES_URL)
        logger.info("Connected to PostgreSQL")

        raw_df = _load_pg_clinical_history(conn)
        mongo_df = _load_mongo_outcomes()
        if not mongo_df.empty and "patient_id" in mongo_df.columns:
            raw_df = pd.concat([raw_df, mongo_df], ignore_index=True)

        features_df = _engineer_features(raw_df)

        if len(features_df) < 50:
            logger.warning("Only %d rows — augmenting with synthetic data", len(features_df))
            synth_X, synth_y = _generate_synthetic_data(max(500, 800 - len(features_df)))
            inv_map = {v: k for k, v in CATEGORY_MAP.items()}
            synth_X["label"] = synth_y.map(inv_map).fillna("preventive")
            features_df = pd.concat([features_df, synth_X], ignore_index=True)

        features_df["label_enc"] = features_df["label"].map(CATEGORY_MAP).fillna(9).astype(int)

        X = features_df[FEATURE_COLS]
        y = features_df["label_enc"]
        conn.close()

    except Exception:
        logger.warning("PostgreSQL unavailable — using synthetic data", exc_info=True)
        X, y = _generate_synthetic_data()

    logger.info("Training set: %d samples, %d classes", len(y), y.nunique())

    # --- Pipeline --------------------------------------------------------
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", GradientBoostingClassifier(random_state=123)),
    ])

    param_grid = {
        "clf__n_estimators": [80, 150, 250],
        "clf__max_depth": [4, 6, 8],
        "clf__learning_rate": [0.05, 0.1, 0.2],
    }

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=123)

    logger.info("Starting GridSearchCV (5-fold) …")
    search = GridSearchCV(
        pipeline,
        param_grid,
        cv=cv,
        scoring="f1_macro",
        n_jobs=-1,
        verbose=1,
        refit=True,
    )
    search.fit(X, y)

    best = search.best_estimator_
    logger.info("Best params: %s", search.best_params_)
    logger.info("Best CV F1-macro: %.4f", search.best_score_)

    # --- Evaluate --------------------------------------------------------
    y_pred = best.predict(X)
    metrics = {
        "accuracy": float(accuracy_score(y, y_pred)),
        "f1_macro": float(f1_score(y, y_pred, average="macro")),
        "f1_weighted": float(f1_score(y, y_pred, average="weighted")),
        "best_cv_f1_macro": float(search.best_score_),
        "best_params": {k: v if not isinstance(v, np.integer) else int(v) for k, v in search.best_params_.items()},
        "n_samples": int(len(y)),
        "n_classes": int(y.nunique()),
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    logger.info("Metrics:\n%s", json.dumps(metrics, indent=2, default=str))
    logger.info("Classification report:\n%s", classification_report(y, y_pred))

    # --- Save model ------------------------------------------------------
    os.makedirs(os.path.dirname(OUTPUT_PATH) or ".", exist_ok=True)
    joblib.dump(best, OUTPUT_PATH)
    logger.info("Model saved → %s", OUTPUT_PATH)

    # --- Log to MongoDB --------------------------------------------------
    try:
        from pymongo import MongoClient

        client = MongoClient(MONGODB_URI)
        db = client[MONGODB_DB]
        db["ml_training_logs"].insert_one({
            "model": "recommendation_ranking",
            "version": "1.0.0",
            **metrics,
        })
        client.close()
        logger.info("Metrics persisted to MongoDB ml_training_logs")
    except Exception:
        logger.warning("Could not log metrics to MongoDB", exc_info=True)


if __name__ == "__main__":
    train()
    sys.exit(0)

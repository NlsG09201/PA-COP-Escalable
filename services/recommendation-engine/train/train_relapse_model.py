"""
Training pipeline for the relapse-prediction model.

Loads patient therapy / emotion / adherence data from MongoDB when available (legacy PostgreSQL path removed),
engineers features, trains a VotingClassifier (RandomForest + LogisticRegression),
tunes hyperparameters via GridSearchCV with Stratified K-Fold,
and persists the best model + metrics.

Usage:
    python -m train.train_relapse_model          # uses env defaults
    RECO_MONGODB_URI=... python -m train.train_relapse_model
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
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    roc_auc_score,
)
from sklearn.model_selection import GridSearchCV, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("train_relapse_model")

MONGODB_URI: str = os.getenv("RECO_MONGODB_URI", "mongodb://cop:cop_dev_password_change_me@localhost:27017/cop?authSource=admin")
MONGODB_DB: str = os.getenv("RECO_MONGODB_DB", "cop")
OUTPUT_PATH: str = os.getenv("RECO_RELAPSE_MODEL_PATH", "app/ml/weights/relapse_model.joblib")


# ── Data loading (MongoDB collections, when present) ───────────────────────────

def _load_collection(name: str) -> pd.DataFrame:
    try:
        from pymongo import MongoClient

        client = MongoClient(MONGODB_URI)
        db = client[MONGODB_DB]
        docs = list(db[name].find({}, {"_id": 0}))
        client.close()
        if docs:
            return pd.DataFrame(docs)
    except Exception:
        logger.warning("Could not load MongoDB collection %s", name, exc_info=True)
    return pd.DataFrame()


# ── Feature engineering ──────────────────────────────────────────────────────

NEGATIVE_LABELS = {"sadness", "anger", "fear", "disgust", "anxiety", "frustration"}


def _engineer_features(
    sessions_df: pd.DataFrame,
    emotions_df: pd.DataFrame,
    adherence_df: pd.DataFrame,
) -> pd.DataFrame:
    records: list[dict] = []

    patient_ids = set(sessions_df["patient_id"].unique())
    patient_ids |= set(emotions_df["patient_id"].unique())
    patient_ids |= set(adherence_df["patient_id"].unique())

    for pid in patient_ids:
        s = sessions_df[sessions_df["patient_id"] == pid]
        e = emotions_df[emotions_df["patient_id"] == pid]
        a = adherence_df[adherence_df["patient_id"] == pid]

        if s.empty:
            session_frequency = 0.0
            avg_therapy_score = 0.0
            session_score_variance = 0.0
            avg_session_duration = 0.0
            session_gap_mean = 0.0
            score_rolling_mean_3 = 0.0
        else:
            dates = pd.to_datetime(s["session_date"]).sort_values()
            total_weeks = max((dates.max() - dates.min()).days / 7.0, 1.0)
            session_frequency = len(s) / total_weeks

            avg_therapy_score = float(s["score"].mean())
            session_score_variance = float(s["score"].var()) if len(s) > 1 else 0.0
            avg_session_duration = float(s["duration_min"].mean())

            gaps = dates.diff().dt.days.dropna()
            session_gap_mean = float(gaps.mean()) if len(gaps) > 0 else 0.0

            rolling = s.sort_values("session_date")["score"].rolling(3, min_periods=1).mean()
            score_rolling_mean_3 = float(rolling.iloc[-1]) if len(rolling) > 0 else 0.0

        if len(e) >= 2:
            emotion_values = e.sort_values("recorded_at")["score"].values.astype(float)
            x = np.arange(len(emotion_values), dtype=float)
            emotion_trend_slope = float(np.polyfit(x, emotion_values, 1)[0])
        else:
            emotion_trend_slope = 0.0

        if not e.empty:
            neg_count = e["label"].str.lower().isin(NEGATIVE_LABELS).sum()
            negative_emotion_ratio = float(neg_count) / len(e)
        else:
            negative_emotion_ratio = 0.0

        if not a.empty:
            medication_adherence = float(a["medication_adherence"].iloc[0])
            last_date = pd.to_datetime(a["last_assessment_date"].iloc[0])
            days_since_assessment = (pd.Timestamp.now() - last_date).days
        else:
            medication_adherence = 0.5
            days_since_assessment = 60

        records.append({
            "patient_id": pid,
            "session_frequency": session_frequency,
            "avg_therapy_score": avg_therapy_score,
            "emotion_trend_slope": emotion_trend_slope,
            "medication_adherence": medication_adherence,
            "days_since_assessment": float(days_since_assessment),
            "negative_emotion_ratio": negative_emotion_ratio,
            "session_score_variance": session_score_variance,
            "avg_session_duration": avg_session_duration,
            "session_gap_mean": session_gap_mean,
            "score_rolling_mean_3": score_rolling_mean_3,
        })

    return pd.DataFrame(records)


# ── Synthetic fallback ───────────────────────────────────────────────────────

def _generate_synthetic_data(n: int = 800) -> tuple[pd.DataFrame, pd.Series]:
    rng = np.random.RandomState(42)

    data = pd.DataFrame({
        "session_frequency": rng.uniform(0.0, 5.0, n),
        "avg_therapy_score": rng.uniform(0.0, 10.0, n),
        "emotion_trend_slope": rng.normal(0.0, 0.3, n),
        "medication_adherence": rng.uniform(0.0, 1.0, n),
        "days_since_assessment": rng.randint(0, 120, n).astype(float),
        "negative_emotion_ratio": rng.uniform(0.0, 1.0, n),
        "session_score_variance": rng.uniform(0.0, 2.0, n),
        "avg_session_duration": rng.uniform(15.0, 90.0, n),
        "session_gap_mean": rng.uniform(1.0, 30.0, n),
        "score_rolling_mean_3": rng.uniform(0.0, 10.0, n),
    })

    risk = (
        -0.10 * data["session_frequency"]
        - 0.08 * data["avg_therapy_score"]
        - 0.40 * data["emotion_trend_slope"]
        - 0.50 * data["medication_adherence"]
        + 0.005 * data["days_since_assessment"]
        + 0.40 * data["negative_emotion_ratio"]
        + 0.10 * data["session_score_variance"]
        - 0.003 * data["avg_session_duration"]
        + 0.01 * data["session_gap_mean"]
        - 0.02 * data["score_rolling_mean_3"]
    )
    prob = 1.0 / (1.0 + np.exp(-(risk + rng.normal(0, 0.15, n))))
    labels = (prob > 0.5).astype(int)

    return data, pd.Series(labels, name="relapsed")


# ── Training ─────────────────────────────────────────────────────────────────

FEATURE_COLS = [
    "session_frequency",
    "avg_therapy_score",
    "emotion_trend_slope",
    "medication_adherence",
    "days_since_assessment",
    "negative_emotion_ratio",
    "session_score_variance",
    "avg_session_duration",
    "session_gap_mean",
    "score_rolling_mean_3",
]


def train() -> None:
    # --- Load data -------------------------------------------------------
    X: pd.DataFrame
    y: pd.Series

    try:
        sessions_df = _load_collection("therapy_sessions")
        emotions_df = _load_collection("emotion_scores")
        adherence_df = _load_collection("patient_adherence")
        labels_df = _load_collection("relapse_labels")

        if sessions_df.empty or labels_df.empty or "relapsed" not in labels_df.columns:
            raise ValueError("Missing therapy_sessions or relapse_labels in MongoDB")

        features_df = _engineer_features(sessions_df, emotions_df, adherence_df)
        merged = features_df.merge(labels_df, on="patient_id", how="inner")

        if len(merged) < 50:
            logger.warning("Only %d labelled rows — augmenting with synthetic data", len(merged))
            synth_X, synth_y = _generate_synthetic_data(max(500, 800 - len(merged)))
            synth_X["relapsed"] = synth_y
            merged = pd.concat([merged, synth_X], ignore_index=True)

        X = merged[FEATURE_COLS]
        y = merged["relapsed"]

    except Exception:
        logger.warning("Training data not available — using synthetic data", exc_info=True)
        X, y = _generate_synthetic_data()

    logger.info("Training set: %d samples, %.1f%% positive", len(y), 100 * y.mean())

    # --- Pipeline --------------------------------------------------------
    rf = RandomForestClassifier(random_state=42, class_weight="balanced")
    lr = LogisticRegression(max_iter=1000, random_state=42, class_weight="balanced")

    voting = VotingClassifier(
        estimators=[("rf", rf), ("lr", lr)],
        voting="soft",
    )

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", voting),
    ])

    param_grid = {
        "clf__rf__n_estimators": [100, 200],
        "clf__rf__max_depth": [6, 10, None],
        "clf__lr__C": [0.1, 1.0, 10.0],
    }

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    logger.info("Starting GridSearchCV (5-fold) …")
    search = GridSearchCV(
        pipeline,
        param_grid,
        cv=cv,
        scoring="roc_auc",
        n_jobs=-1,
        verbose=1,
        refit=True,
    )
    search.fit(X, y)

    best = search.best_estimator_
    logger.info("Best params: %s", search.best_params_)
    logger.info("Best CV ROC-AUC: %.4f", search.best_score_)

    # --- Evaluate on full set (for logging, not true test) ---------------
    y_pred = best.predict(X)
    y_proba = best.predict_proba(X)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y, y_pred)),
        "f1": float(f1_score(y, y_pred)),
        "roc_auc": float(roc_auc_score(y, y_proba)),
        "best_cv_roc_auc": float(search.best_score_),
        "best_params": search.best_params_,
        "n_samples": int(len(y)),
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
            "model": "relapse_prediction",
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

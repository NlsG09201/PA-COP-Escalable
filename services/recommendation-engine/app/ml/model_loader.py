from __future__ import annotations

import logging
import os
from typing import Any

import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier

logger = logging.getLogger("recommendation-engine.model_loader")

_RELAPSE_FEATURE_NAMES: list[str] = [
    "session_frequency",
    "avg_therapy_score",
    "emotion_trend_slope",
    "medication_adherence",
    "days_since_assessment",
    "negative_emotion_ratio",
    "session_score_variance",
    "avg_session_duration",
]

_RECOMMENDATION_FEATURE_NAMES: list[str] = [
    "num_entries",
    "num_conditions",
    "specialty_flag",
    "type_feat_1",
    "type_feat_2",
    "type_feat_3",
    "has_surgical",
    "has_chronic",
]


class ModelLoader:
    """Loads, caches, and exposes ML models for relapse prediction and
    clinical recommendation ranking."""

    def __init__(self, relapse_path: str, recommendation_path: str) -> None:
        self.relapse_path = relapse_path
        self.recommendation_path = recommendation_path
        self.relapse_model: Any | None = None
        self.recommendation_model: Any | None = None

    # ── Loaders ──────────────────────────────────────────────────────────

    def load_relapse_model(self) -> None:
        if os.path.isfile(self.relapse_path):
            try:
                self.relapse_model = joblib.load(self.relapse_path)
                logger.info("Relapse model loaded from %s", self.relapse_path)
                return
            except Exception:
                logger.warning("Failed to load relapse model from disk — creating default", exc_info=True)

        logger.info("Training default relapse model with synthetic data …")
        self.relapse_model = self._create_default_relapse_model()
        self._save_model(self.relapse_model, self.relapse_path)

    def load_recommendation_model(self) -> None:
        if os.path.isfile(self.recommendation_path):
            try:
                self.recommendation_model = joblib.load(self.recommendation_path)
                logger.info("Recommendation model loaded from %s", self.recommendation_path)
                return
            except Exception:
                logger.warning("Failed to load recommendation model from disk — creating default", exc_info=True)

        logger.info("Training default recommendation model with synthetic data …")
        self.recommendation_model = self._create_default_recommendation_model()
        self._save_model(self.recommendation_model, self.recommendation_path)

    # ── Inference ────────────────────────────────────────────────────────

    def predict_relapse(self, features: np.ndarray) -> tuple[float, list[tuple[str, float]]]:
        """Return (risk_score 0-1, list of (feature_name, importance))."""
        if self.relapse_model is None:
            raise RuntimeError("Relapse model not loaded")

        probas = self.relapse_model.predict_proba(features)
        risk_score = float(probas[0][1]) if probas.shape[1] > 1 else float(probas[0][0])

        if hasattr(self.relapse_model, "feature_importances_"):
            importances = self.relapse_model.feature_importances_
        else:
            importances = np.full(features.shape[1], 1.0 / features.shape[1])

        named_importances = list(zip(_RELAPSE_FEATURE_NAMES, importances.tolist()))
        return risk_score, named_importances

    def predict_recommendations(self, features: np.ndarray) -> list[int]:
        """Return list of predicted recommendation-category indices."""
        if self.recommendation_model is None:
            raise RuntimeError("Recommendation model not loaded")

        probas = self.recommendation_model.predict_proba(features)[0]
        threshold = 0.10
        indices = [i for i, p in enumerate(probas) if p >= threshold]

        if not indices:
            indices = [int(np.argmax(probas))]

        return indices

    # ── Default model builders ───────────────────────────────────────────

    @staticmethod
    def _create_default_relapse_model() -> RandomForestClassifier:
        rng = np.random.RandomState(42)
        n_samples = 500

        session_freq = rng.uniform(0.0, 5.0, n_samples)
        avg_score = rng.uniform(0.0, 10.0, n_samples)
        emo_slope = rng.normal(0.0, 0.3, n_samples)
        med_adherence = rng.uniform(0.0, 1.0, n_samples)
        days_since = rng.randint(0, 120, n_samples).astype(float)
        neg_ratio = rng.uniform(0.0, 1.0, n_samples)
        score_var = rng.uniform(0.0, 2.0, n_samples)
        avg_duration = rng.uniform(15.0, 90.0, n_samples)

        X = np.column_stack([
            session_freq, avg_score, emo_slope, med_adherence,
            days_since, neg_ratio, score_var, avg_duration,
        ])

        risk = (
            -0.10 * session_freq
            - 0.08 * avg_score
            - 0.40 * emo_slope
            - 0.50 * med_adherence
            + 0.005 * days_since
            + 0.40 * neg_ratio
            + 0.10 * score_var
            - 0.003 * avg_duration
        )
        noise = rng.normal(0, 0.15, n_samples)
        prob = 1.0 / (1.0 + np.exp(-(risk + noise)))
        y = (prob > 0.5).astype(int)

        model = RandomForestClassifier(
            n_estimators=100,
            max_depth=8,
            min_samples_split=10,
            random_state=42,
            class_weight="balanced",
        )
        model.fit(X, y)
        logger.info("Default relapse RandomForest trained (accuracy on train: %.3f)", model.score(X, y))
        return model

    @staticmethod
    def _create_default_recommendation_model() -> GradientBoostingClassifier:
        rng = np.random.RandomState(123)
        n_samples = 600
        n_classes = 10

        num_entries = rng.randint(0, 30, n_samples).astype(float)
        num_conditions = rng.randint(0, 10, n_samples).astype(float)
        specialty_flag = rng.choice([0.0, 1.0], n_samples)
        type_feat_1 = rng.uniform(0, 15, n_samples)
        type_feat_2 = rng.uniform(0, 10, n_samples)
        type_feat_3 = rng.uniform(0, 5, n_samples)
        has_surgical = rng.choice([0.0, 1.0], n_samples, p=[0.7, 0.3])
        has_chronic = rng.choice([0.0, 1.0], n_samples, p=[0.6, 0.4])

        X = np.column_stack([
            num_entries, num_conditions, specialty_flag,
            type_feat_1, type_feat_2, type_feat_3,
            has_surgical, has_chronic,
        ])

        y = rng.randint(0, n_classes, n_samples)
        y = np.where(
            (specialty_flag == 1.0) & (has_surgical == 1.0),
            3,  # surgical
            y,
        )
        y = np.where(
            (specialty_flag == 0.0) & (has_chronic == 1.0),
            4,  # psychotherapy
            y,
        )

        model = GradientBoostingClassifier(
            n_estimators=80,
            max_depth=5,
            learning_rate=0.1,
            random_state=123,
        )
        model.fit(X, y)
        logger.info("Default recommendation GBClassifier trained (accuracy on train: %.3f)", model.score(X, y))
        return model

    # ── Persistence ──────────────────────────────────────────────────────

    @staticmethod
    def _save_model(model: Any, path: str) -> None:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        joblib.dump(model, path)
        logger.info("Model saved to %s", path)

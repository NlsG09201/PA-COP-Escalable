from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

import numpy as np

from app.models.schemas import (
    RelapsePredictionRequest,
    RelapsePredictionResponse,
    RiskFactor,
    RiskLevel,
)

if TYPE_CHECKING:
    from pymongo.database import Database

    from app.ml.model_loader import ModelLoader

logger = logging.getLogger("recommendation-engine.relapse_service")

_FEATURE_NAMES: list[str] = [
    "session_frequency",
    "avg_therapy_score",
    "emotion_trend_slope",
    "medication_adherence",
    "days_since_assessment",
    "negative_emotion_ratio",
    "session_score_variance",
    "avg_session_duration",
]

_RISK_ACTIONS: dict[str, list[str]] = {
    "LOW": [
        "Continue current treatment plan",
        "Schedule routine follow-up in 4 weeks",
    ],
    "MEDIUM": [
        "Increase session frequency to weekly",
        "Administer PHQ-9 / GAD-7 at next visit",
        "Review medication adherence with patient",
        "Schedule follow-up within 2 weeks",
    ],
    "HIGH": [
        "Escalate to senior clinician for review",
        "Increase session frequency to twice weekly",
        "Consider medication adjustment with psychiatrist",
        "Implement safety planning",
        "Schedule follow-up within 1 week",
    ],
    "CRITICAL": [
        "Immediate clinical review required",
        "Activate crisis protocol and safety plan",
        "Coordinate with psychiatry for urgent medication review",
        "Consider intensive outpatient or inpatient programme",
        "Daily check-in until risk level decreases",
    ],
}


class RelapseService:
    def __init__(self, model_loader: ModelLoader, mongo_db: Database | None) -> None:
        self._loader = model_loader
        self._db = mongo_db

    # ── Public API ───────────────────────────────────────────────────────

    def predict_relapse(self, req: RelapsePredictionRequest) -> RelapsePredictionResponse:
        features = self._extract_features(req)
        feature_array = np.array([features])

        if self._loader.relapse_model is not None:
            risk_score, importances = self._loader.predict_relapse(feature_array)
            contributing = self._importances_to_factors(importances)
            confidence = min(0.95, 0.6 + 0.05 * len(req.therapy_sessions))
        else:
            risk_score = self._rule_based_score(features)
            contributing = self._rule_based_factors(features)
            confidence = 0.55

        risk_level = self._score_to_level(risk_score)
        actions = _RISK_ACTIONS.get(risk_level.value, _RISK_ACTIONS["MEDIUM"])

        now_iso = datetime.now(timezone.utc).isoformat()
        response = RelapsePredictionResponse(
            patient_id=req.patient_id,
            risk_score=round(risk_score, 4),
            risk_level=risk_level,
            contributing_factors=contributing,
            recommended_actions=actions,
            confidence=round(confidence, 4),
            generated_at=now_iso,
        )

        self._persist_prediction(req.patient_id, response)
        return response

    def get_latest_risk(self, patient_id: str) -> dict[str, Any] | None:
        if self._db is None:
            return None
        doc = self._db["relapse_predictions"].find_one(
            {"patient_id": patient_id},
            {"_id": 0},
            sort=[("generated_at", -1)],
        )
        return doc

    def get_risk_trend(self, patient_id: str) -> list[dict[str, Any]]:
        if self._db is None:
            return []
        docs = list(
            self._db["relapse_predictions"]
            .find(
                {"patient_id": patient_id},
                {"_id": 0, "risk_score": 1, "risk_level": 1, "generated_at": 1, "confidence": 1},
            )
            .sort("generated_at", 1)
            .limit(100)
        )
        return docs

    # ── Feature extraction ───────────────────────────────────────────────

    def _extract_features(self, req: RelapsePredictionRequest) -> list[float]:
        session_frequency = req.session_frequency

        scores = [s.score for s in req.therapy_sessions] if req.therapy_sessions else [0.0]
        avg_therapy_score = float(np.mean(scores))
        session_score_variance = float(np.var(scores)) if len(scores) > 1 else 0.0

        durations = [s.duration_min for s in req.therapy_sessions] if req.therapy_sessions else [0]
        avg_session_duration = float(np.mean(durations))

        if len(req.emotion_scores) >= 2:
            emotion_values = [e.score for e in req.emotion_scores]
            x = np.arange(len(emotion_values), dtype=float)
            y = np.array(emotion_values, dtype=float)
            if np.std(x) > 0:
                emotion_trend_slope = float(np.polyfit(x, y, 1)[0])
            else:
                emotion_trend_slope = 0.0
        else:
            emotion_trend_slope = 0.0

        negative_labels = {"sadness", "anger", "fear", "disgust", "anxiety", "frustration"}
        if req.emotion_scores:
            neg_count = sum(1 for e in req.emotion_scores if e.label.lower() in negative_labels)
            negative_emotion_ratio = neg_count / len(req.emotion_scores)
        else:
            negative_emotion_ratio = 0.0

        medication_adherence = req.medication_adherence
        days_since_assessment = float(req.last_assessment_days)

        return [
            session_frequency,
            avg_therapy_score,
            emotion_trend_slope,
            medication_adherence,
            days_since_assessment,
            negative_emotion_ratio,
            session_score_variance,
            avg_session_duration,
        ]

    # ── Rule-based fallback ──────────────────────────────────────────────

    @staticmethod
    def _rule_based_score(features: list[float]) -> float:
        weights = {
            "session_frequency": -0.10,
            "avg_therapy_score": -0.15,
            "emotion_trend_slope": -0.15,
            "medication_adherence": -0.20,
            "days_since_assessment": 0.003,
            "negative_emotion_ratio": 0.20,
            "session_score_variance": 0.05,
            "avg_session_duration": -0.002,
        }

        base = 0.35
        score = base
        for i, name in enumerate(_FEATURE_NAMES):
            score += weights.get(name, 0.0) * features[i]

        return float(np.clip(score, 0.0, 1.0))

    @staticmethod
    def _rule_based_factors(features: list[float]) -> list[RiskFactor]:
        factors: list[RiskFactor] = []

        if features[3] < 0.7:
            factors.append(RiskFactor(
                factor="Low medication adherence",
                weight=round(0.7 - features[3], 3),
                description=f"Adherence is {features[3]:.0%}, below the 70 % safety threshold",
            ))

        if features[0] < 1.0:
            factors.append(RiskFactor(
                factor="Infrequent therapy sessions",
                weight=round(1.0 - features[0], 3) if features[0] < 1.0 else 0.0,
                description=f"Session frequency is {features[0]:.1f}/week; recommended minimum is 1/week",
            ))

        if features[2] < -0.05:
            factors.append(RiskFactor(
                factor="Declining emotional trajectory",
                weight=round(abs(features[2]), 3),
                description="Emotion scores show a downward trend over recent assessments",
            ))

        if features[4] > 30:
            factors.append(RiskFactor(
                factor="Delayed assessment",
                weight=round(min((features[4] - 30) / 60, 1.0), 3),
                description=f"{int(features[4])} days since last formal assessment; recommended interval is <= 30 days",
            ))

        if features[5] > 0.5:
            factors.append(RiskFactor(
                factor="High negative emotion ratio",
                weight=round(features[5] - 0.5, 3),
                description=f"{features[5]:.0%} of recent emotion entries are negative (threshold 50 %)",
            ))

        if features[6] > 0.3:
            factors.append(RiskFactor(
                factor="Unstable therapy scores",
                weight=round(min(features[6], 1.0), 3),
                description="High variance in therapy session scores indicates inconsistent progress",
            ))

        if not factors:
            factors.append(RiskFactor(
                factor="Baseline risk",
                weight=0.1,
                description="No specific elevated risk factors identified; maintaining baseline monitoring",
            ))

        return factors

    # ── ML helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _importances_to_factors(importances: list[tuple[str, float]]) -> list[RiskFactor]:
        factors: list[RiskFactor] = []
        for name, weight in sorted(importances, key=lambda x: x[1], reverse=True)[:5]:
            if weight < 0.01:
                continue
            factors.append(RiskFactor(
                factor=name.replace("_", " ").title(),
                weight=round(weight, 4),
                description=f"Feature '{name}' contributed {weight:.2%} to the risk prediction",
            ))
        return factors if factors else [RiskFactor(factor="Model aggregate", weight=0.1, description="Prediction based on aggregate model signal")]

    @staticmethod
    def _score_to_level(score: float) -> RiskLevel:
        if score >= 0.75:
            return RiskLevel.CRITICAL
        if score >= 0.50:
            return RiskLevel.HIGH
        if score >= 0.25:
            return RiskLevel.MEDIUM
        return RiskLevel.LOW

    # ── Persistence ──────────────────────────────────────────────────────

    def _persist_prediction(self, patient_id: str, response: RelapsePredictionResponse) -> None:
        if self._db is None:
            return
        try:
            doc = response.model_dump()
            doc["patient_id"] = patient_id
            self._db["relapse_predictions"].insert_one(doc)
        except Exception:
            logger.warning("Failed to persist relapse prediction to MongoDB", exc_info=True)

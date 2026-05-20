from __future__ import annotations

import logging
from typing import Any

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

logger = logging.getLogger("recommendation-engine.ensemble")

router = APIRouter(prefix="/api/medical/ensemble", tags=["medical-ensemble"])

_FEATURE_ORDER = [
    "anxiety",
    "depression",
    "stress",
    "adherence",
    "attendance_irregular",
    "days_since_last_session",
    "negative_emotion_ratio",
    "session_count_90d",
    "scale_severity_avg",
    "prior_relapse",
    "j48_risk_score",
]

_MODEL_CACHE: dict[str, Any] = {}


class EnsemblePredictRequest(BaseModel):
    patient_id: str
    organization_id: str | None = None
    features: dict[str, float] = Field(default_factory=dict)
    j48_risk_score: float | None = Field(default=None, ge=0, le=100)


class ModelVote(BaseModel):
    model: str
    relapse_probability: float
    risk_level: str


class EnsemblePredictResponse(BaseModel):
    patient_id: str
    ensemble_probability: float
    risk_level: str
    dynamic_psychological_score: float
    model_votes: list[ModelVote]
    clinical_recommendations: list[str]
    early_warning: bool
    confidence: float


def _vectorize(features: dict[str, float], j48_risk_score: float | None) -> np.ndarray:
    merged = dict(features)
    if j48_risk_score is not None:
        merged["j48_risk_score"] = float(j48_risk_score)
    row = [float(merged.get(k, 0.0)) for k in _FEATURE_ORDER]
    return np.array([row], dtype=np.float64)


def _risk_level(score: float) -> str:
    if score >= 0.75:
        return "CRITICAL"
    if score >= 0.55:
        return "HIGH"
    if score >= 0.35:
        return "MEDIUM"
    return "LOW"


def _recommendations(level: str) -> list[str]:
    base = {
        "CRITICAL": [
            "Activar protocolo de crisis y plan de seguridad",
            "Sesión de seguimiento en menos de 48 horas",
            "Revisión conjunta psicología y odontología",
        ],
        "HIGH": [
            "Incrementar frecuencia de sesiones a semanal",
            "Aplicar PHQ-9 y GAD-7 en próxima consulta",
            "Monitoreo de adherencia terapéutica",
        ],
        "MEDIUM": [
            "Mantener seguimiento quincenal",
            "Reforzar técnicas de regulación emocional",
        ],
        "LOW": [
            "Continuar plan terapéutico actual",
            "Control rutinario en 4 semanas",
        ],
    }
    return base.get(level, base["MEDIUM"])


def _synthetic_train_set(n: int = 800) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(42)
    x = rng.random((n, len(_FEATURE_ORDER)))
    x[:, 0:3] *= 1.2
    y = (x[:, 0] * 0.25 + x[:, 1] * 0.3 + x[:, 2] * 0.15 + x[:, 3] * 0.2 + x[:, 10] * 0.1) > 0.55
    return x, y.astype(int)


def _get_random_forest() -> RandomForestClassifier:
    if "rf" not in _MODEL_CACHE:
        x, y = _synthetic_train_set()
        model = RandomForestClassifier(n_estimators=120, max_depth=8, random_state=42)
        model.fit(x, y)
        _MODEL_CACHE["rf"] = model
    return _MODEL_CACHE["rf"]


def _get_xgboost():
    if "xgb" not in _MODEL_CACHE:
        try:
            from xgboost import XGBClassifier

            x, y = _synthetic_train_set()
            model = XGBClassifier(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.08,
                subsample=0.9,
                eval_metric="logloss",
                random_state=42,
            )
            model.fit(x, y)
            _MODEL_CACHE["xgb"] = model
        except ImportError:
            from sklearn.ensemble import GradientBoostingClassifier

            x, y = _synthetic_train_set()
            model = GradientBoostingClassifier(random_state=42)
            model.fit(x, y)
            _MODEL_CACHE["xgb"] = model
    return _MODEL_CACHE["xgb"]


def _j48_vote(j48_risk_score: float | None) -> ModelVote:
    score = float(j48_risk_score if j48_risk_score is not None else 40.0)
    prob = min(0.98, max(0.02, score / 100.0))
    return ModelVote(model="J48", relapse_probability=round(prob, 4), risk_level=_risk_level(prob))


@router.post("/predict", response_model=EnsemblePredictResponse)
async def predict_ensemble(body: EnsemblePredictRequest) -> EnsemblePredictResponse:
    try:
        vec = _vectorize(body.features, body.j48_risk_score)
        rf = _get_random_forest()
        xgb = _get_xgboost()

        rf_prob = float(rf.predict_proba(vec)[0][1])
        xgb_prob = float(xgb.predict_proba(vec)[0][1])
        j48_vote = _j48_vote(body.j48_risk_score)

        votes = [
            ModelVote(model="RandomForest", relapse_probability=round(rf_prob, 4), risk_level=_risk_level(rf_prob)),
            ModelVote(model="XGBoost", relapse_probability=round(xgb_prob, 4), risk_level=_risk_level(xgb_prob)),
            j48_vote,
        ]

        ensemble_prob = float(np.mean([v.relapse_probability for v in votes]))
        level = _risk_level(ensemble_prob)
        dynamic_score = round(ensemble_prob * 100, 1)

        return EnsemblePredictResponse(
            patient_id=body.patient_id,
            ensemble_probability=round(ensemble_prob, 4),
            risk_level=level,
            dynamic_psychological_score=dynamic_score,
            model_votes=votes,
            clinical_recommendations=_recommendations(level),
            early_warning=ensemble_prob >= 0.55,
            confidence=round(min(0.95, 0.55 + 0.12 * len(body.features)), 4),
        )
    except Exception as exc:
        logger.exception("ensemble predict failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

"""Pydantic request / response schemas for the Emotion Analysis service."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class EmotionLabel(str, Enum):
    STRESS = "STRESS"
    ANXIETY = "ANXIETY"
    SADNESS = "SADNESS"
    ANGER = "ANGER"
    CALM = "CALM"
    NEUTRAL = "NEUTRAL"
    JOY = "JOY"


class EmotionPrediction(BaseModel):
    label: EmotionLabel
    confidence: float = Field(..., ge=0.0, le=1.0)


class ProsodyFeatures(BaseModel):
    pitch_mean: float
    pitch_std: float
    energy_mean: float
    energy_std: float
    speech_rate: float
    pause_ratio: float
    pitch_contour: list[float]
    energy_contour: list[float]


class EmotionAnalysisResponse(BaseModel):
    job_id: str
    status: str
    primary_emotion: EmotionPrediction
    all_emotions: list[EmotionPrediction]
    prosody: ProsodyFeatures
    audio_duration_sec: float
    patient_id: Optional[str] = None
    analyzed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    model_version: str = "1.0.0"


class AsyncJobResponse(BaseModel):
    job_id: str
    status: str


class ModelInfo(BaseModel):
    version: str
    accuracy: Optional[float] = None
    classes: list[str]
    last_trained: Optional[str] = None
    wav2vec_model: str
    device: str

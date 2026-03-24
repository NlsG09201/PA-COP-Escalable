from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ── Enums ────────────────────────────────────────────────────────────────────

class Priority(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Specialty(str, Enum):
    ODONTOLOGY = "ODONTOLOGY"
    PSYCHOLOGY = "PSYCHOLOGY"


# ── Clinical Recommendations ────────────────────────────────────────────────

class ClinicalEntry(BaseModel):
    date: str
    type: str
    description: str
    professional_id: str | None = None


class Recommendation(BaseModel):
    action: str
    priority: Priority
    evidence_level: str
    rationale: str
    category: str


class ClinicalRecommendationRequest(BaseModel):
    patient_id: str
    clinical_history: list[ClinicalEntry] = Field(default_factory=list)
    current_conditions: list[str] = Field(default_factory=list)
    specialty: Specialty


class ClinicalRecommendationResponse(BaseModel):
    patient_id: str
    recommendations: list[Recommendation]
    model_version: str = "1.0.0"
    generated_at: str


# ── Relapse Prediction ──────────────────────────────────────────────────────

class TherapySession(BaseModel):
    date: str
    type: str
    score: float
    duration_min: int
    notes: str | None = None


class EmotionScore(BaseModel):
    date: str
    label: str
    score: float


class RiskFactor(BaseModel):
    factor: str
    weight: float
    description: str


class RelapsePredictionRequest(BaseModel):
    patient_id: str
    therapy_sessions: list[TherapySession] = Field(default_factory=list)
    emotion_scores: list[EmotionScore] = Field(default_factory=list)
    medication_adherence: float = Field(ge=0.0, le=1.0)
    session_frequency: float = Field(ge=0.0, description="Sessions per week")
    last_assessment_days: int = Field(ge=0)
    clinical_metrics: dict[str, Any] = Field(default_factory=dict)


class RelapsePredictionResponse(BaseModel):
    patient_id: str
    risk_score: float = Field(ge=0.0, le=1.0)
    risk_level: RiskLevel
    contributing_factors: list[RiskFactor]
    recommended_actions: list[str]
    confidence: float = Field(ge=0.0, le=1.0)
    generated_at: str


# ── Treatment Optimisation ──────────────────────────────────────────────────

class TreatmentStep(BaseModel):
    order: int
    action: str
    expected_duration_days: int
    rationale: str


class PatientProfile(BaseModel):
    patient_id: str
    age: int | None = None
    conditions: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    current_medications: list[str] = Field(default_factory=list)


class CurrentTreatment(BaseModel):
    plan_id: str
    specialty: Specialty
    steps: list[TreatmentStep] = Field(default_factory=list)
    start_date: str | None = None
    status: str = "ACTIVE"


class OptimisedStep(BaseModel):
    original_order: int | None = None
    action: str
    change_type: str = Field(description="ADD | MODIFY | REMOVE | KEEP")
    rationale: str
    expected_improvement: str


class TreatmentOptimizationRequest(BaseModel):
    patient_profile: PatientProfile
    current_treatment: CurrentTreatment


class TreatmentOptimizationResponse(BaseModel):
    patient_id: str
    plan_id: str
    optimised_steps: list[OptimisedStep]
    summary: str
    model_version: str = "1.0.0"
    generated_at: str

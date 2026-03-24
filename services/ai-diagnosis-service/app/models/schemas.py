"""Pydantic schemas shared across routers and services."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DiagnosisLabel(str, Enum):
    """Possible diagnostic labels produced by the CNN."""

    CARIES = "CARIES"
    INFECTION = "INFECTION"
    WEAR = "WEAR"
    FRACTURE = "FRACTURE"
    PERIAPICAL_LESION = "PERIAPICAL_LESION"
    HEALTHY = "HEALTHY"


class JobStatus(str, Enum):
    """Lifecycle states for an asynchronous diagnosis job."""

    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Finding(BaseModel):
    """A single diagnostic finding for a dental image."""

    label: DiagnosisLabel
    confidence: float = Field(..., ge=0.0, le=1.0)
    description: str
    bbox: Optional[list[float]] = Field(
        default=None,
        description="Optional bounding box [x, y, width, height].",
    )


class DiagnosisResponse(BaseModel):
    """Full response returned after analysing a dental image."""

    job_id: str
    status: JobStatus = JobStatus.COMPLETED
    findings: list[Finding] = Field(default_factory=list)
    image_id: str
    patient_id: Optional[str] = None
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)
    model_version: str = "1.0.0"


class AsyncJobResponse(BaseModel):
    """Acknowledgement returned when a job is queued for async processing."""

    job_id: str
    status: str = "QUEUED"


class ModelInfo(BaseModel):
    """Metadata about the currently loaded model."""

    version: str
    accuracy: float
    classes: list[str]
    last_trained: Optional[datetime] = None
    device: str


class TrainRequest(BaseModel):
    """Parameters accepted when triggering fine-tuning."""

    epochs: int = Field(default=10, ge=1)
    learning_rate: float = Field(default=0.001, gt=0.0)
    batch_size: int = Field(default=32, ge=1)

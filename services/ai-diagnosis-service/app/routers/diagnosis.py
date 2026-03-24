"""Diagnosis endpoints — synchronous analysis, async queueing, results, and training."""

from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile

from app.models.schemas import (
    AsyncJobResponse,
    DiagnosisResponse,
    ModelInfo,
    TrainRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/diagnosis", tags=["diagnosis"])


def _svc(request: Request):
    """Shortcut to retrieve the shared DiagnosisService from app state."""
    return request.app.state.diagnosis_service


# ------------------------------------------------------------------
# Synchronous single-image analysis
# ------------------------------------------------------------------


@router.post("/analyze", response_model=DiagnosisResponse)
async def analyze(
    request: Request,
    image: UploadFile = File(...),
    patient_id: Optional[str] = Query(default=None),
) -> DiagnosisResponse:
    """Accept an uploaded dental image, run CNN inference, and return findings."""
    content = await image.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    return await _svc(request).analyze_image(content, patient_id=patient_id)


# ------------------------------------------------------------------
# Asynchronous (Redis Stream-backed) analysis
# ------------------------------------------------------------------


@router.post("/analyze-async", response_model=AsyncJobResponse)
async def analyze_async(
    request: Request,
    image: UploadFile = File(...),
    patient_id: Optional[str] = Query(default=None),
) -> AsyncJobResponse:
    """Queue an image for background analysis via Redis Stream."""
    content = await image.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    filename = image.filename or "upload.png"
    return await _svc(request).analyze_async(content, filename, patient_id=patient_id)


# ------------------------------------------------------------------
# Job result retrieval
# ------------------------------------------------------------------


@router.get("/results/{job_id}")
async def get_result(request: Request, job_id: str):
    """Fetch the result of a previously submitted job, or report its current status."""
    result = await _svc(request).get_result(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return result


# ------------------------------------------------------------------
# Training data management
# ------------------------------------------------------------------


@router.post("/train/upload-dataset")
async def upload_dataset(
    request: Request,
    files: list[UploadFile] = File(...),
    labels: str = Query(..., description='JSON object mapping filename to label, e.g. {"img1.png":"CARIES"}'),
) -> dict:
    """Upload training images together with a JSON label mapping."""
    try:
        label_map: dict[str, str] = json.loads(labels)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid labels JSON: {exc}") from exc

    file_pairs: list[tuple[str, bytes]] = []
    for f in files:
        content = await f.read()
        file_pairs.append((f.filename or "unknown.png", content))

    return await _svc(request).upload_training_data(file_pairs, label_map)


@router.post("/train/start")
async def start_training(request: Request, params: TrainRequest = TrainRequest()) -> dict:
    """Trigger model fine-tuning in a background thread."""
    return await _svc(request).start_training(params)


# ------------------------------------------------------------------
# Model info
# ------------------------------------------------------------------


@router.get("/model/info", response_model=ModelInfo)
async def model_info(request: Request) -> ModelInfo:
    """Return metadata about the currently loaded model."""
    loader = request.app.state.model_loader
    info = loader.get_info()
    return ModelInfo(**info)

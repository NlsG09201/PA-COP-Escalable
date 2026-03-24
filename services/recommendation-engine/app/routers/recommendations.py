from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.models.schemas import (
    ClinicalRecommendationRequest,
    ClinicalRecommendationResponse,
    TreatmentOptimizationRequest,
    TreatmentOptimizationResponse,
)
from app.services.recommendation_service import RecommendationService

logger = logging.getLogger("recommendation-engine.recommendations")

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


def _service(request: Request) -> RecommendationService:
    return RecommendationService(
        model_loader=request.app.state.model_loader,
        mongo_db=getattr(request.app.state, "mongo", None),
    )


@router.post("/clinical", response_model=ClinicalRecommendationResponse)
async def clinical_recommendations(
    body: ClinicalRecommendationRequest,
    request: Request,
) -> ClinicalRecommendationResponse:
    logger.info("Clinical recommendation request for patient=%s specialty=%s", body.patient_id, body.specialty)
    try:
        return _service(request).recommend_clinical(body)
    except Exception as exc:
        logger.exception("Error generating clinical recommendations")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/treatment-optimization", response_model=TreatmentOptimizationResponse)
async def treatment_optimization(
    body: TreatmentOptimizationRequest,
    request: Request,
) -> TreatmentOptimizationResponse:
    logger.info(
        "Treatment optimization request for patient=%s plan=%s",
        body.patient_profile.patient_id,
        body.current_treatment.plan_id,
    )
    try:
        return _service(request).optimize_treatment(body)
    except Exception as exc:
        logger.exception("Error optimising treatment")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/patient/{patient_id}/history")
async def recommendation_history(patient_id: str, request: Request) -> list[dict[str, Any]]:
    mongo_db = getattr(request.app.state, "mongo", None)
    if mongo_db is None:
        raise HTTPException(status_code=503, detail="MongoDB unavailable")

    docs = list(
        mongo_db["recommendations"]
        .find({"patient_id": patient_id}, {"_id": 0})
        .sort("generated_at", -1)
        .limit(50)
    )
    return docs

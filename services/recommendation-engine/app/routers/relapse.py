from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.models.schemas import RelapsePredictionRequest, RelapsePredictionResponse
from app.services.relapse_service import RelapseService

logger = logging.getLogger("recommendation-engine.relapse")

router = APIRouter(prefix="/api/relapse", tags=["relapse"])


def _service(request: Request) -> RelapseService:
    return RelapseService(
        model_loader=request.app.state.model_loader,
        mongo_db=getattr(request.app.state, "mongo", None),
    )


@router.post("/predict", response_model=RelapsePredictionResponse)
async def predict_relapse(
    body: RelapsePredictionRequest,
    request: Request,
) -> RelapsePredictionResponse:
    logger.info("Relapse prediction request for patient=%s", body.patient_id)
    try:
        return _service(request).predict_relapse(body)
    except Exception as exc:
        logger.exception("Error predicting relapse")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/patient/{patient_id}/risk")
async def latest_risk(patient_id: str, request: Request) -> dict[str, Any]:
    svc = _service(request)
    result = svc.get_latest_risk(patient_id)
    if result is None:
        raise HTTPException(status_code=404, detail="No risk assessment found")
    return result


@router.get("/patient/{patient_id}/trend")
async def risk_trend(patient_id: str, request: Request) -> list[dict[str, Any]]:
    svc = _service(request)
    return svc.get_risk_trend(patient_id)

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.ml.model_service import model_service

router = APIRouter(tags=["predict"])


class PredictBody(BaseModel):
    gender: str | None = None
    age_group: str | None = None
    sentiment: str | None = None
    wellbeing: str | None = None
    anxiety: float | None = Field(default=None, ge=0, le=1)
    depression: float | None = Field(default=None, ge=0, le=1)
    attendance: str | None = None
    days_since_last: float | None = Field(default=None, ge=0)

    model_config = {"extra": "allow"}


@router.post("/predict")
def predict(body: PredictBody) -> dict[str, Any]:
    if not model_service.ready:
        raise HTTPException(status_code=503, detail="Modelo no listo")
    payload = body.model_dump(exclude_none=True)
    payload.update({k: v for k, v in body.model_extra.items() if v is not None})
    return model_service.predict(payload)


@router.post("/train")
def train() -> dict[str, Any]:
    try:
        return model_service.train_and_persist()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/model/tree")
def tree() -> dict[str, Any]:
    if not model_service.ready:
        raise HTTPException(status_code=503, detail="Modelo no listo")
    return model_service.tree_visualization()


@router.get("/model/metrics")
def metrics() -> dict[str, Any]:
    if not model_service.ready:
        raise HTTPException(status_code=503, detail="Modelo no listo")
    return model_service._metrics

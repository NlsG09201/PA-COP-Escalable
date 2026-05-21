from __future__ import annotations

from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.ml.lab_service import lab_service

router = APIRouter(prefix="/lab", tags=["weka-lab"])


class TrainConfigBody(BaseModel):
    datasetId: str | None = None
    modelName: str | None = None
    version: str | None = "1.0.0"
    targetColumn: str | None = None
    featureColumns: list[str] | None = None
    testSize: float = Field(default=0.2, ge=0.1, le=0.5)
    maxDepth: int | None = Field(default=8, ge=1, le=50)
    minSamplesLeaf: int = Field(default=5, ge=1, le=100)
    minSamplesSplit: int = Field(default=2, ge=2, le=100)
    ccpAlpha: float = Field(default=0.0, ge=0.0, le=1.0)
    cvFolds: int = Field(default=5, ge=2, le=10)
    randomState: int = 42
    setActive: bool = True


class PredictClinicalBody(BaseModel):
    modelId: str | None = None
    gender: str | None = None
    age_group: str | None = None
    sentiment: str | None = None
    wellbeing: str | None = None
    anxiety: float | None = Field(default=None, ge=0, le=1)
    depression: float | None = Field(default=None, ge=0, le=1)
    stress: float | None = Field(default=None, ge=0, le=1)
    attendance: str | None = None
    days_since_last: float | None = Field(default=None, ge=0)
    adherence: str | None = None
    symptoms: str | None = None
    prior_relapse: str | None = None
    emotional_state: str | None = None

    model_config = {"extra": "allow"}


class CompareBody(BaseModel):
    modelIds: list[str]


@router.get("/datasets")
def list_datasets() -> list[dict[str, Any]]:
    return lab_service.list_datasets()


@router.post("/datasets/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    displayName: str | None = None,
) -> dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nombre de archivo requerido")
    lower = file.filename.lower()
    if not (lower.endswith(".csv") or lower.endswith(".arff")):
        raise HTTPException(status_code=400, detail="Solo CSV o ARFF")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Archivo mayor a 50MB")
    if len(content) < 10:
        raise HTTPException(status_code=400, detail="Archivo vacío")
    try:
        return lab_service.upload_dataset(content, file.filename, displayName)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/datasets/{dataset_id}")
def get_dataset(dataset_id: str) -> dict[str, Any]:
    try:
        return lab_service.get_dataset(dataset_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/datasets/{dataset_id}")
def delete_dataset(dataset_id: str) -> dict[str, bool]:
    try:
        lab_service.delete_dataset(dataset_id)
        return {"ok": True}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/train")
def train(body: TrainConfigBody) -> dict[str, Any]:
    try:
        return lab_service.train_model(body.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/models")
def list_models() -> list[dict[str, Any]]:
    return lab_service.list_models()


@router.get("/models/{model_id}")
def get_model(model_id: str) -> dict[str, Any]:
    try:
        return lab_service.get_model(model_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/models/{model_id}/tree")
def model_tree(model_id: str) -> dict[str, Any]:
    try:
        return lab_service.get_model_tree(model_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/models/{model_id}/activate")
def activate_model(model_id: str) -> dict[str, Any]:
    try:
        return lab_service.set_active_model(model_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/models/{model_id}")
def delete_model(model_id: str) -> dict[str, bool]:
    try:
        lab_service.delete_model(model_id)
        return {"ok": True}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/models/compare")
def compare_models(body: CompareBody) -> list[dict[str, Any]]:
    return lab_service.compare_models(body.modelIds)


@router.post("/predict/clinical")
def predict_clinical(body: PredictClinicalBody) -> dict[str, Any]:
    try:
        payload = body.model_dump(exclude_none=True)
        model_id = payload.pop("modelId", None)
        return lab_service.predict_clinical(payload, model_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/dashboard")
def dashboard() -> dict[str, Any]:
    return lab_service.dashboard_stats()

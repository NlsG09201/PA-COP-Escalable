from fastapi import APIRouter

from app.ml.model_service import model_service

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    return {"ok": True, "ready": model_service.ready}


@router.get("/info")
def info() -> dict:
    return model_service.info()

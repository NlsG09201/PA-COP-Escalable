"""Health-check endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(request: Request) -> dict:
    model_loader = request.app.state.model_loader
    return {
        "status": "healthy",
        "model_loaded": model_loader.loaded if model_loader else False,
        "wav2vec_loaded": model_loader.wav2vec_loaded if model_loader else False,
        "version": "1.0.0",
    }

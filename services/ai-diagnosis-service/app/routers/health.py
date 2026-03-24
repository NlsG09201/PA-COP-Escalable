"""Health-check endpoint used by Docker HEALTHCHECK and orchestrators."""

from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(request: Request) -> dict:
    """Return service health including model-loaded status."""
    model_loader = request.app.state.model_loader
    return {
        "status": "healthy",
        "model_loaded": getattr(model_loader, "loaded", False),
        "version": "1.0.0",
    }

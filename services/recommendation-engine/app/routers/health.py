from __future__ import annotations

import logging

from fastapi import APIRouter, Request

logger = logging.getLogger("recommendation-engine.health")

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check(request: Request) -> dict:
    loader = getattr(request.app.state, "model_loader", None)
    relapse_loaded = loader is not None and loader.relapse_model is not None
    recommendation_loaded = loader is not None and loader.recommendation_model is not None

    redis_ok = False
    try:
        redis_client = getattr(request.app.state, "redis", None)
        if redis_client is not None:
            await redis_client.ping()
            redis_ok = True
    except Exception:
        logger.debug("Redis health-check ping failed", exc_info=True)

    mongo_ok = False
    try:
        mongo_db = getattr(request.app.state, "mongo", None)
        if mongo_db is not None:
            mongo_db.command("ping")
            mongo_ok = True
    except Exception:
        logger.debug("MongoDB health-check ping failed", exc_info=True)

    pg_ok = False
    try:
        pg_conn = getattr(request.app.state, "pg", None)
        if pg_conn is not None and not pg_conn.closed:
            with pg_conn.cursor() as cur:
                cur.execute("SELECT 1")
            pg_ok = True
    except Exception:
        logger.debug("PostgreSQL health-check failed", exc_info=True)

    return {
        "status": "UP",
        "models": {
            "relapse": {
                "loaded": relapse_loaded,
                "version": "1.0.0" if relapse_loaded else None,
            },
            "recommendation": {
                "loaded": recommendation_loaded,
                "version": "1.0.0" if recommendation_loaded else None,
            },
        },
        "dependencies": {
            "redis": redis_ok,
            "mongodb": mongo_ok,
            "postgresql": pg_ok,
        },
    }

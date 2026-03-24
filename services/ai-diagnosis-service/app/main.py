"""FastAPI application entry-point for the AI Diagnosis micro-service."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from gridfs import GridFS
from pymongo import MongoClient
from redis.asyncio import Redis

from app.config import settings
from app.ml.model_loader import DentalModelLoader
from app.routers import diagnosis, health
from app.services.diagnosis_service import DiagnosisService
from app.services.redis_consumer import RedisStreamConsumer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    """Startup / shutdown lifecycle hook.

    On startup:
        1. Load the ONNX model.
        2. Connect to Redis.
        3. Connect to MongoDB and initialise GridFS.
        4. Wire up the :class:`DiagnosisService`.
        5. Launch the background Redis Stream consumer task.

    On shutdown:
        * Cancel the consumer task.
        * Close Redis and MongoDB connections.
    """
    # --- ML model ---
    model_loader = DentalModelLoader(
        model_path=settings.MODEL_PATH,
        device=settings.MODEL_DEVICE,
    )
    model_loader.load()
    application.state.model_loader = model_loader

    # --- Redis ---
    redis_client = Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        decode_responses=False,
    )
    application.state.redis = redis_client

    # --- MongoDB / GridFS ---
    mongo_client = MongoClient(settings.MONGODB_URI)
    mongo_db = mongo_client[settings.MONGODB_DB]
    gridfs_bucket = GridFS(mongo_db)
    application.state.mongo_client = mongo_client
    application.state.mongo_db = mongo_db
    application.state.gridfs = gridfs_bucket

    # --- Diagnosis service ---
    diag_service = DiagnosisService(
        model_loader=model_loader,
        mongo_db=mongo_db,
        gridfs_bucket=gridfs_bucket,
        redis_client=redis_client,
        settings=settings,
    )
    application.state.diagnosis_service = diag_service

    # --- Redis Stream consumer ---
    consumer = RedisStreamConsumer(
        redis_client=redis_client,
        diagnosis_service=diag_service,
        stream_key=settings.STREAM_KEY_REQUESTS,
        group_name=settings.CONSUMER_GROUP,
        consumer_name=settings.CONSUMER_NAME,
        batch_size=settings.BATCH_SIZE,
        poll_interval_ms=settings.POLL_INTERVAL_MS,
    )
    consumer_task = asyncio.create_task(consumer.start())
    application.state.consumer = consumer
    application.state.consumer_task = consumer_task

    logger.info("ai-diagnosis-service started successfully.")
    yield

    # --- Shutdown ---
    await consumer.stop()
    consumer_task.cancel()
    try:
        await consumer_task
    except asyncio.CancelledError:
        pass

    await redis_client.aclose()
    mongo_client.close()
    logger.info("ai-diagnosis-service shut down cleanly.")


# ------------------------------------------------------------------
# Application instance
# ------------------------------------------------------------------

app = FastAPI(
    title="AI Diagnosis Service",
    description="Dental image diagnosis powered by EfficientNet CNN.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(diagnosis.router)


# ------------------------------------------------------------------
# Global exception handlers
# ------------------------------------------------------------------


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    """Return a structured 422 with readable error details."""
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Validation error",
            "errors": exc.errors(),
        },
    )


@app.exception_handler(Exception)
async def generic_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    """Catch-all so unhandled exceptions never leak stack traces to clients."""
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

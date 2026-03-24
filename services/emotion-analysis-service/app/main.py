"""FastAPI application entry-point for the Emotion Analysis micro-service."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

import pymongo
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.asyncio import Redis

from app.config import settings
from app.ml.model_loader import EmotionModelLoader
from app.routers import emotion, health
from app.services.emotion_service import EmotionService
from app.services.redis_consumer import run_consumer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup / shutdown lifecycle hook."""

    # --- ML model ---
    model_loader = EmotionModelLoader(
        wav2vec_model_name=settings.WAV2VEC_MODEL,
        onnx_path=settings.EMOTION_MODEL_PATH,
    )
    try:
        model_loader.load()
    except Exception:
        logger.exception("Failed to load ML models – service will start degraded")
    app.state.model_loader = model_loader

    # --- MongoDB ---
    mongo_client = pymongo.MongoClient(settings.MONGODB_URI)
    db = mongo_client[settings.MONGODB_DB]
    app.state.mongo_client = mongo_client
    app.state.mongo_db = db
    logger.info("MongoDB connected: %s", settings.MONGODB_DB)

    # --- Redis ---
    redis = Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        decode_responses=False,
    )
    app.state.redis = redis
    logger.info("Redis connected: %s:%s", settings.REDIS_HOST, settings.REDIS_PORT)

    # --- EmotionService ---
    emotion_service = EmotionService(
        model_loader=model_loader,
        db=db,
        redis=redis,
    )
    app.state.emotion_service = emotion_service

    # --- Redis Stream consumer background task ---
    stop_event = asyncio.Event()
    consumer_task = asyncio.create_task(
        run_consumer(redis, emotion_service, stop_event=stop_event)
    )
    app.state.consumer_task = consumer_task
    app.state.stop_event = stop_event

    logger.info("Emotion Analysis Service started")
    yield

    # --- Shutdown ---
    logger.info("Shutting down…")
    stop_event.set()
    consumer_task.cancel()
    try:
        await consumer_task
    except asyncio.CancelledError:
        pass

    await redis.aclose()
    mongo_client.close()
    logger.info("Shutdown complete")


app = FastAPI(
    title="Emotion Analysis Service",
    version="1.0.0",
    description="Voice / audio emotion analysis using wav2vec2 + prosody features",
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
app.include_router(emotion.router)


@app.exception_handler(ValueError)
async def value_error_handler(_request: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def generic_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

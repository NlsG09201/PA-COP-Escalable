"""Centralised configuration loaded from environment variables."""

from __future__ import annotations

import socket
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGODB_URI: str = (
        "mongodb://cop:cop_dev_password_change_me@localhost:27017/cop?authSource=admin"
    )
    MONGODB_DB: str = "cop"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    WAV2VEC_MODEL: str = "facebook/wav2vec2-base"
    EMOTION_MODEL_PATH: str = "app/ml/weights/emotion_classifier.onnx"
    CONFIDENCE_THRESHOLD: float = 0.4
    SAMPLE_RATE: int = 16_000
    MAX_AUDIO_DURATION_SEC: int = 300

    STREAM_KEY_REQUESTS: str = "cop:emotion:requests"
    STREAM_KEY_RESULTS: str = "cop:emotion:results"
    CONSUMER_GROUP: str = "emotion-workers"
    CONSUMER_NAME: str = f"worker-{socket.gethostname()}"
    BATCH_SIZE: int = 10
    POLL_INTERVAL_MS: int = 1000

    model_config = {"env_prefix": "EMOTION_"}


settings = Settings()

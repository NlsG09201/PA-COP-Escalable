"""Application configuration loaded from environment variables with sensible defaults."""

from __future__ import annotations

import socket
import uuid

from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_consumer_name() -> str:
    """Generate a unique consumer name from hostname and a short UUID suffix."""
    host = socket.gethostname()
    short_id = uuid.uuid4().hex[:8]
    return f"{host}-{short_id}"


class Settings(BaseSettings):
    """All tunables for the ai-diagnosis-service, overridable via ``DIAG_*`` env vars."""

    model_config = SettingsConfigDict(env_prefix="DIAG_")

    # --- MongoDB ---
    MONGODB_URI: str = (
        "mongodb://cop:cop_dev_password_change_me@localhost:27017/cop?authSource=admin"
    )
    MONGODB_DB: str = "cop"

    # --- Redis ---
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    # --- ML Model ---
    MODEL_PATH: str = "app/ml/weights/dental_efficientnet.onnx"
    MODEL_DEVICE: str = "cpu"
    CONFIDENCE_THRESHOLD: float = 0.5

    # --- Redis Streams ---
    STREAM_KEY_REQUESTS: str = "cop:diagnosis:requests"
    STREAM_KEY_RESULTS: str = "cop:diagnosis:results"
    CONSUMER_GROUP: str = "diagnosis-workers"
    CONSUMER_NAME: str = _default_consumer_name()
    BATCH_SIZE: int = 10
    POLL_INTERVAL_MS: int = 1000


settings = Settings()

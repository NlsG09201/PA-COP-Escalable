from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGODB_URI: str = "mongodb://cop:cop_dev_password_change_me@localhost:27017/cop?authSource=admin"
    MONGODB_DB: str = "cop"
    POSTGRES_URL: str = "postgresql://cop:cop_dev_password_change_me@localhost:5432/cop"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    RELAPSE_MODEL_PATH: str = "app/ml/weights/relapse_model.joblib"
    RECOMMENDATION_MODEL_PATH: str = "app/ml/weights/recommendation_model.joblib"

    STREAM_KEY_REQUESTS: str = "cop:recommendation:requests"
    STREAM_KEY_RESULTS: str = "cop:recommendation:results"
    CONSUMER_GROUP: str = "recommendation-engine"
    CONSUMER_NAME: str = "worker-1"
    BATCH_SIZE: int = 10
    POLL_INTERVAL_MS: int = 2000

    model_config = {"env_prefix": "RECO_"}


settings = Settings()

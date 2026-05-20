from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="J48_", extra="ignore")

    arff_path: str = "/data/relapse_risk_j48.arff"
    model_path: str = "/models/j48_sklearn.joblib"
    auto_train: bool = True
    max_depth: int | None = 8
    min_samples_leaf: int = 5
    random_state: int = 42
    host: str = "0.0.0.0"
    port: int = 8080


settings = Settings()

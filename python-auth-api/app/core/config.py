from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "medical-api"
    env: str = "dev"

    mongodb_uri: str
    mongodb_db: str = "medical"

    redis_url: str

    jwt_secret: str
    jwt_alg: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 14

    security_password_bcrypt_rounds: int = 12

    rate_limit_enabled: bool = True
    rate_limit_window_seconds: int = 60
    rate_limit_max_requests: int = 30

    session_ttl_seconds: int = 3600
    token_blacklist_prefix: str = "bl"
    session_prefix: str = "sess"
    rate_limit_prefix: str = "rl"


settings = Settings()

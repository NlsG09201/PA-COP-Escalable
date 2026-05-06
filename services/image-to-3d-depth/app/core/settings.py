from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="IMG3D_", env_file=".env", extra="ignore")

    # API
    service_name: str = "image-to-3d-depth"
    log_level: str = "INFO"
    cors_allow_origins: str = ""

    # Celery / Redis
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    # Storage
    storage_mode: str = "local"  # local | s3
    local_storage_dir: str = "/data/models"
    public_base_url: str = ""  # when serving via gateway/reverse-proxy

    # S3 (optional)
    s3_endpoint_url: str = ""
    s3_region: str = "us-east-1"
    s3_bucket: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_prefix: str = "reconstructions/"
    s3_presign_exp_seconds: int = 3600

    # Depth model
    depth_model: str = "DPT_Large"  # MiDaS model: DPT_Large | DPT_Hybrid | MiDaS_small
    device: str = "auto"  # auto | cpu | cuda
    torch_num_threads: int = 0  # 0 = keep default

    # Reconstruction defaults
    out_format: str = "ply"  # ply | obj | stl
    make_mesh_default: bool = False
    voxel_downsample: float = 2.0
    estimate_normals: bool = True
    poisson_depth: int = 9
    point_cloud_max_points: int = 350_000

    # Camera intrinsics defaults (if not provided)
    intrinsics_fx_scale: float = 1.2
    intrinsics_fy_scale: float = 1.2


settings = Settings()


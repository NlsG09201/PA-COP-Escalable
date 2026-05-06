from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field


OutputFormat = Literal["ply", "obj", "stl"]


class ReconstructRequest(BaseModel):
    output_format: OutputFormat = Field(default="ply")
    make_mesh: bool = Field(default=False)

    # Optional camera intrinsics. If omitted we derive reasonable defaults from image size.
    fx: Optional[float] = None
    fy: Optional[float] = None
    cx: Optional[float] = None
    cy: Optional[float] = None

    # Optional depth post-processing
    depth_scale: float = Field(default=1.0, ge=1e-6)
    depth_offset: float = Field(default=0.0)


class JobEnqueuedResponse(BaseModel):
    job_id: str
    status: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    model_id: Optional[str] = None
    download_url: Optional[str] = None
    error: Optional[str] = None
    meta: dict = Field(default_factory=dict)


class ModelInfo(BaseModel):
    model_id: str
    output_format: OutputFormat
    bytes: int
    storage_mode: str
    url: str


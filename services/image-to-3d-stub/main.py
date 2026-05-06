"""
Dev / fallback Image→3D API compatible with nest-migration Ortho3dService expectations.

Returns an immediate GLB URL (Khronos Duck sample) so Nest can download and serve the mesh.
Replace this service in production with Meshy, Tripo3D, Meshy, Fal, Replicate, etc. via
ORTHO_IMAGE_TO_3D_* environment variables on nest-backend.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, Field

# Small, stable binary GLB over HTTPS (Nest backend downloads and re-serves with auth).
DEMO_GLB_URL = (
    "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/"
    "refs/heads/main/2.0/Duck/glTF-Binary/Duck.glb"
)

app = FastAPI(title="Image→3D stub", version="1.0.0")


@app.get("/", response_class=HTMLResponse)
def root() -> str:
    # Evita 404 si se abre :8010 en el navegador; el cliente real es Nest, no SPA.
    return (
        "<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"utf-8\"/>"
        "<title>Image→3D stub</title>"
        '<link rel="icon" href="data:image/svg+xml,'
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>"
        "<rect width='32' height='32' rx='6' fill='%236366f1'/></svg>"
        "\"/>"
        "</head><body><p>Servicio interno Image→3D (stub). "
        'API: <a href="/docs">OpenAPI (/docs)</a> · '
        '<a href="/health">health</a>.</p></body></html>'
    )


@app.get("/favicon.ico", include_in_schema=False)
def favicon() -> Response:
    """El navegador pide favicon por defecto; sin esto aparece 404 en consola."""
    return Response(status_code=204)


class CreateBody(BaseModel):
    image_url: str | None = None
    images: list[str] | None = Field(default=None, description="Base64 data URIs from Nest")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/openapi/v1/image-to-3d")
def create_job(body: CreateBody) -> dict[str, Any]:
    job_id = str(uuid.uuid4())
    # Pretend synchronous success so Nest can poll or treat as immediate result.
    return {
        "jobId": job_id,
        "id": job_id,
        "status": "SUCCEEDED",
        "state": "complete",
        "glb_url": DEMO_GLB_URL,
        "glbUrl": DEMO_GLB_URL,
        "result_url": DEMO_GLB_URL,
    }


@app.get("/openapi/v1/image-to-3d/{job_id}")
def poll_job(job_id: str) -> dict[str, Any]:
    return {
        "jobId": job_id,
        "id": job_id,
        "status": "SUCCEEDED",
        "state": "complete",
        "glb_url": DEMO_GLB_URL,
        "glbUrl": DEMO_GLB_URL,
        "result_url": DEMO_GLB_URL,
    }

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
    # Evita 404 si se abre :8010 en el navegador. El usuario final NO modela aquí: es API para Nest.
    return """<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Image→3D stub (solo API)</title>
  <link rel="icon" href="data:image/svg+xml,
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
    <rect width='32' height='32' rx='6' fill='%236366f1'/></svg>"/>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem;
           line-height: 1.5; color: #1e293b; }
    h1 { font-size: 1.25rem; }
    .box { background: #f1f5f9; border-radius: 8px; padding: 1rem 1.25rem; margin: 1rem 0; }
    a { color: #4f46e5; }
    code { background: #e2e8f0; padding: 0.1em 0.35em; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Servicio interno Image→3D (stub)</h1>
  <p><strong>Aquí no se suben fotos ni se ve el modelo 3D.</strong> Este puerto es una API que usa
     el backend (Nest) cuando generas el GLB desde la aplicación clínica.</p>
  <div class="box">
    <p><strong>Para modelar con imágenes:</strong></p>
    <ol>
      <li>Abre el <strong>Dashboard</strong>: <a href="http://localhost:5173">http://localhost:5173</a></li>
      <li>Inicia sesión y elige un <strong>paciente</strong>.</li>
      <li>Entra a <strong>Odontograma avanzado</strong> o <strong>Simulación 3D</strong> y usa
          la sección de reconstrucción / fotos (el navegador habla con el API en el puerto
          <code>8080</code>, no con este).</li>
    </ol>
  </div>
  <p>Uso técnico (desarrollo): <a href="/docs">OpenAPI (/docs)</a> · <a href="/health">health</a></p>
</body>
</html>"""


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

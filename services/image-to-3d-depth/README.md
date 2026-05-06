# Image→Depth→3D (FastAPI + Celery)

Servicio productizable para generar un modelo 3D aproximado a partir de una imagen 2D usando un modelo de depth (MiDaS).

## Ejecutar (Docker Compose)

- Requiere: Docker Desktop

Desde la raíz del repo:

```bash
docker compose --profile ai up -d --build redis image-to-3d-depth
```

API (por defecto): `http://localhost:8011`

## Endpoints

- `POST /reconstruct-3d` (multipart) → encola job
- `GET /jobs/{job_id}` → estado + URLs
- `GET /models/{model_id}` → metadata
- `GET /models/{model_id}/download` → descarga (local) o URL firmada (S3)
- `GET /health`

## Consumo en frontend (Three.js / vtk.js)

- **PLY**: usar loader PLY (tres) y construir `Points` o `Mesh` (si viene como malla).
- **OBJ**: usar OBJLoader.
- **STL**: usar STLLoader.

El endpoint `GET /models/{model_id}/download` responde:
- en **local storage**: `Content-Disposition: attachment` con el binario.
- en **S3**: `302` o un JSON con `url` (según configuración).


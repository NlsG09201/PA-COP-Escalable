from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uvicorn
import os
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Importar módulos locales
from ia.processor import AdvancedToothProcessor
from .simulator import OrthoSimulator

app = FastAPI(title="Orthodontic AI Platform API", version="2.0.0")

# Manejador global para errores de validación (422)
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Error de validación en {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )

# Configuración CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir archivos estáticos
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Inicializar servicios
processor = AdvancedToothProcessor()
simulator = OrthoSimulator()

# Modelos de datos para Pydantic
class ToothAdjustment(BaseModel):
    id: str
    target_x: float = 0
    target_y: float = 0
    target_z: float = 0
    target_rx: float = 0
    target_ry: float = 0
    target_rz: float = 0

class SimulationRequest(BaseModel):
    initial_state: Dict[str, Any]
    adjustments: List[ToothAdjustment]
    months: int = 18

@app.get("/")
async def root():
    return FileResponse(os.path.join(static_dir, "index.html"))

@app.post("/api/reconstruct")
async def reconstruct_3d(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen.")
        
    try:
        contents = await file.read()
        # Usar el nuevo pipeline avanzado
        teeth_data = processor.reconstruct_3d_from_image(contents)
        return {
            "status": "success",
            "teeth_count": len(teeth_data),
            "data": teeth_data
        }
    except Exception as e:
        logger.error(f"Error en reconstrucción: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/simulate")
async def run_simulation(request: SimulationRequest):
    try:
        # Usar el nuevo simulador con interpolación sigmoidal
        adjustments_list = [adj.dict() for adj in request.adjustments]
        timeline = simulator.calculate_treatment_evolution(
            request.initial_state, 
            adjustments_list, 
            request.months
        )
        return {
            "status": "success",
            "timeline": timeline
        }
    except Exception as e:
        logger.error(f"Error en simulación: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001) # Cambiado a 8001 para evitar conflictos

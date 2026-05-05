from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
import uvicorn
import os

# Importar módulos locales
from ia.processor import ToothProcessor
from .simulator import OrthoSimulator

app = FastAPI(title="Orthodontic AI Platform API", version="1.0.0")

# Configuración CORS para el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir archivos estáticos del frontend
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Inicializar servicios
processor = ToothProcessor()
simulator = OrthoSimulator()

# Modelos de datos
class ToothAdjustment(BaseModel):
    id: str
    target_x: float = 0
    target_y: float = 0
    target_z: float = 0
    target_rx: float = 0
    target_ry: float = 0
    target_rz: float = 0

class SimulationRequest(BaseModel):
    initial_state: List[Dict]
    adjustments: List[ToothAdjustment]
    months: int = 12

@app.get("/")
async def root():
    return FileResponse(os.path.join(static_dir, "index.html"))

@app.post("/api/reconstruct")
async def reconstruct_3d(file: UploadFile = File(...)):
    """
    Endpoint para generar modelo 3D a partir de una imagen (radiografía/foto).
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen.")
        
    try:
        contents = await file.read()
        teeth_data = processor.segment_teeth(contents)
        return {
            "status": "success",
            "teeth_count": len(teeth_data),
            "data": teeth_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/simulate")
async def run_simulation(request: SimulationRequest):
    """
    Endpoint para simular el movimiento dental basado en el plan de tratamiento.
    """
    try:
        # Convertir ajustes de Pydantic a Dict para el simulador
        adjustments_dict = [adj.dict() for adj in request.adjustments]
        timeline = simulator.generate_simulation_plan(
            request.initial_state, 
            adjustments_dict, 
            request.months
        )
        return {
            "status": "success",
            "timeline": timeline
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

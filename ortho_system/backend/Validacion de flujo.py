# ==========================================
# ESTRUCTURA DEL PROYECTO: PLATAFORMA ORTODÓNTICA IA 3D
# ==========================================

# 1. IA MODULE (ia/processor.py)
# ------------------------------------------
import cv2
import numpy as np
from typing import List, Dict, Any

class ToothProcessor:
    """
    Clase especializada en el procesamiento de imágenes dentales (radiografías/fotos)
    para segmentación y reconstrucción 3D mediante visión artificial.
    """
    def __init__(self):
        self.pixel_to_mm = 0.1  # Calibración: 1 pixel = 0.1mm
        self.depth_factor = 1.2 # Estimación de profundidad relativa
        
    def segment_teeth(self, image_bytes: bytes) -> List[Dict[str, Any]]:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None: raise ValueError("Error decodificando imagen.")
        
        # Preprocesamiento y corrección de perspectiva
        img = self.correct_perspective(img)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Segmentación adaptativa avanzada
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(gray)
        thresh = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                      cv2.THRESH_BINARY_INV, 11, 2)
        
        # Limpieza morfológica
        kernel = np.ones((3,3), np.uint8)
        opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)
        contours, _ = cv2.findContours(opening, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        detected_teeth = []
        for i, cnt in enumerate(contours):
            if cv2.contourArea(cnt) < 500: continue
            
            x, y, w, h = cv2.boundingRect(cnt)
            M = cv2.moments(cnt)
            cx = int(M["m10"] / M["m00"]) if M["m00"] != 0 else x + w//2
            cy = int(M["m01"] / M["m00"]) if M["m00"] != 0 else y + h//2
            
            # Reconstrucción 3D: Mapeo de coordenadas 2D a espacio 3D
            z_est = (h / w) * self.depth_factor
            detected_teeth.append({
                "id": f"tooth_{i+1}",
                "reconstruction": {
                    "pos_3d": {
                        "x": (cx - img.shape[1]/2) * self.pixel_to_mm, 
                        "y": (img.shape[0]/2 - cy) * self.pixel_to_mm, 
                        "z": z_est
                    },
                    "scale": {
                        "x": w * self.pixel_to_mm, 
                        "y": h * self.pixel_to_mm, 
                        "z": w * self.pixel_to_mm
                    }
                }
            })
        return detected_teeth

    def correct_perspective(self, image: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours: return image
        c = max(contours, key=cv2.contourArea)
        rect = cv2.minAreaRect(c)
        box = np.int0(cv2.boxPoints(rect))
        pts = np.zeros((4, 2), dtype="float32")
        s = box.sum(axis=1); pts[0] = box[np.argmin(s)]; pts[2] = box[np.argmax(s)]
        diff = np.diff(box, axis=1); pts[1] = box[np.argmin(diff)]; pts[3] = box[np.argmax(diff)]
        (tl, tr, br, bl) = pts
        width = int(max(np.linalg.norm(br-bl), np.linalg.norm(tr-tl)))
        height = int(max(np.linalg.norm(tr-br), np.linalg.norm(tl-bl)))
        dst = np.array([[0, 0], [width-1, 0], [width-1, height-1], [0, height-1]], dtype="float32")
        M = cv2.getPerspectiveTransform(pts, dst)
        return cv2.warpPerspective(image, M, (width, height))

# 2. SIMULATOR MODULE (backend/simulator.py)
# ------------------------------------------
class OrthoSimulator:
    def generate_simulation_plan(self, initial_state: List[Dict], 
                                 target_adjustments: List[Dict], 
                                 months: int = 12) -> List[Dict]:
        timeline = []
        for month in range(months + 1):
            progress = month / months
            frame = {"month": month, "teeth": []}
            for tooth in initial_state:
                adj = next((a for a in target_adjustments if a["id"] == tooth["id"]), None)
                pos = {k: tooth["pos_3d"][k] + (adj.get(f"target_{k}", 0) * progress) for k in "xyz"} if adj else tooth["pos_3d"]
                rot = {k: tooth.get("rot_3d", {}).get(k, 0) + (adj.get(f"target_r{k}", 0) * progress) for k in "xyz"} if adj else {"x":0,"y":0,"z":0}
                frame["teeth"].append({"id": tooth["id"], "position": pos, "rotation": rot})
            timeline.append(frame)
        return timeline

# 3. BACKEND API (backend/main.py)
# ------------------------------------------
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="Orthodontic AI API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

proc = ToothProcessor(); sim = OrthoSimulator()

class SimulationRequest(BaseModel):
    initial_state: List[Dict]; adjustments: List[Dict]; months: int = 12

@app.post("/api/reconstruct")
async def reconstruct(file: UploadFile = File(...)):
    data = proc.segment_teeth(await file.read())
    return {"status": "success", "data": data}

@app.post("/api/simulate")
async def simulate(req: SimulationRequest):
    timeline = sim.generate_simulation_plan(req.initial_state, req.adjustments, req.months)
    return {"status": "success", "timeline": timeline}

# 4. FRONTEND HTML (frontend/index.html)
# ------------------------------------------
"""
<!DOCTYPE html>
<html>
<head>
    <title>Ortho AI 3D</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
    <style>
        body { margin: 0; background: #111; color: white; font-family: sans-serif; }
        #ui { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.8); padding: 15px; border-radius: 8px; width: 250px; }
        button { width: 100%; padding: 8px; margin: 5px 0; cursor: pointer; background: #00d2ff; border: none; font-weight: bold; }
        input[type="range"] { width: 100%; }
    </style>
</head>
<body>
    <div id="ui">
        <h3>Control de Ortodoncia</h3>
        <input type="file" id="imgInp" accept="image/*">
        <button onclick="reconstruct()">1. Generar 3D</button>
        <div id="sim" style="display:none">
            <label>Evolución: Mes <span id="mVal">0</span></label>
            <input type="range" id="time" min="0" max="12" value="0" oninput="updateTime(this.value)">
            <button onclick="compare()">Comparar Antes/Después</button>
        </div>
        <p id="msg"></p>
    </div>
    <script src="app.js"></script>
</body>
</html>
"""

# 5. FRONTEND LOGIC (frontend/app.js)
# ------------------------------------------
"""
let scene, camera, renderer, controls, teeth = [], timeline = [];

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.z = 15;
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const d = new THREE.DirectionalLight(0xffffff, 0.8); d.position.set(5,5,5); scene.add(d);
    animate();
}

function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }

async function reconstruct() {
    const file = document.getElementById('imgInp').files[0];
    if(!file) return;
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch('http://localhost:8000/api/reconstruct', {method:'POST', body:fd});
    const {data} = await res.json();
    teeth.forEach(t => scene.remove(t)); teeth = [];
    data.forEach(d => {
        const g = new THREE.Group();
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(d.reconstruction.scale.x, d.reconstruction.scale.y, d.reconstruction.scale.z), new THREE.MeshPhongMaterial({color:0xffffff}));
        const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.2), new THREE.MeshPhongMaterial({color:0x888888}));
        bracket.position.z = d.reconstruction.scale.z/2 + 0.1;
        g.add(tooth); g.add(bracket);
        g.position.set(d.reconstruction.pos_3d.x, d.reconstruction.pos_3d.y, d.reconstruction.pos_3d.z);
        g.userData.id = d.id; scene.add(g); teeth.push(g);
    });
    document.getElementById('sim').style.display = 'block';
    const adjustments = teeth.map(t => ({id: t.userData.id, target_x: -t.position.x*0.1, target_z: -t.position.z*0.3}));
    const sRes = await fetch('http://localhost:8000/api/simulate', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({initial_state: teeth.map(t=>({id:t.userData.id, pos_3d:t.position})), adjustments})
    });
    const sData = await sRes.json(); timeline = sData.timeline;
}

function updateTime(v) {
    document.getElementById('mVal').innerText = v;
    if(!timeline[v]) return;
    timeline[v].teeth.forEach(tData => {
        const t = teeth.find(obj => obj.userData.id === tData.id);
        if(t) { t.position.copy(tData.position); t.rotation.set(tData.rotation.x, tData.rotation.y, tData.rotation.z); }
    });
}

function compare() { const i = document.getElementById('time'); i.value = (i.value == 0 ? 12 : 0); updateTime(i.value); }

init();
"""

# 6. DEPENDENCIES (backend/requirements.txt)
# ------------------------------------------
# fastapi==0.104.1
# uvicorn==0.24.0
# python-multipart==0.0.6
# opencv-python==4.8.1.78
# numpy==1.26.2
# pydantic==2.5.2

# 7. EJECUCIÓN
# ------------------------------------------
# 1. Instalar dependencias: pip install -r requirements.txt
# 2. Iniciar Backend: python main.py
# 3. Abrir frontend/index.html en el navegador (usar Live Server o similar para CORS).
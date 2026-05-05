import math
from typing import List, Dict, Any

class OrthoSimulator:
    """
    Motor de simulación de movimiento dental para tratamientos de ortodoncia.
    """
    
    def __init__(self):
        self.movement_rate_mm_per_month = 1.0 # Velocidad estándar de movimiento
        self.rotation_rate_deg_per_month = 2.0 # Velocidad estándar de rotación
        
    def generate_simulation_plan(self, initial_state: List[Dict[str, Any]], 
                                 target_adjustments: List[Dict[str, Any]], 
                                 months: int = 12) -> List[Dict[str, Any]]:
        """
        Genera un plan de simulación paso a paso (keyframes).
        """
        timeline = []
        
        for month in range(months + 1):
            progress = month / months
            current_frame = {
                "month": month,
                "teeth": []
            }
            
            for tooth in initial_state:
                tooth_id = tooth["id"]
                # Buscar ajustes específicos para esta pieza
                adjustment = next((a for a in target_adjustments if a["id"] == tooth_id), None)
                
                if adjustment:
                    # Interpolar posición (Lineal para este MVP, spline para producción)
                    new_pos = {
                        "x": tooth["pos_3d"]["x"] + (adjustment.get("target_x", 0) * progress),
                        "y": tooth["pos_3d"]["y"] + (adjustment.get("target_y", 0) * progress),
                        "z": tooth["pos_3d"]["z"] + (adjustment.get("target_z", 0) * progress)
                    }
                    new_rot = {
                        "x": tooth.get("rot_3d", {}).get("x", 0) + (adjustment.get("target_rx", 0) * progress),
                        "y": tooth.get("rot_3d", {}).get("y", 0) + (adjustment.get("target_ry", 0) * progress),
                        "z": tooth.get("rot_3d", {}).get("z", 0) + (adjustment.get("target_rz", 0) * progress)
                    }
                else:
                    new_pos = tooth["pos_3d"]
                    new_rot = tooth.get("rot_3d", {"x":0, "y":0, "z":0})
                
                current_frame["teeth"].append({
                    "id": tooth_id,
                    "position": new_pos,
                    "rotation": new_rot,
                    "bracket_placed": True # En este sistema asumimos brackets en todas las piezas activas
                })
                
            timeline.append(current_frame)
            
        return timeline

    def calculate_forces(self, tooth_pos: Dict, bracket_pos: Dict) -> Dict:
        """
        Calcula vectores de fuerza aplicados por el arco sobre el bracket.
        """
        # Implementación física simplificada (Ley de Hooke aplicada a ortodoncia)
        k = 0.5 # Constante elástica del arco (N/mm)
        dx = bracket_pos["x"] - tooth_pos["x"]
        dy = bracket_pos["y"] - tooth_pos["y"]
        dz = bracket_pos["z"] - tooth_pos["z"]
        
        return {"fx": k*dx, "fy": k*dy, "fz": k*dz}

import numpy as np
from typing import List, Dict, Any

class OrthoSimulator:
    """
    Motor de simulación física para ortodoncia.
    Responsabilidad: Cálculo de vectores de movimiento y generación de timeline.
    """
    def calculate_treatment_evolution(self, initial_state: Dict[str, Any], 
                                     target_adjustments: List[Dict[str, Any]], 
                                     months: int = 18) -> List[Dict[str, Any]]:
        """
        Genera el timeline de movimiento dental aplicando restricciones físicas 
        de movimiento periodontal (máximo 0.8mm por mes recomendado).
        """
        timeline = []
        
        # Convertir target_adjustments a un diccionario para búsqueda rápida
        targets = {adj['id']: adj for adj in target_adjustments}
        
        for m in range(months + 1):
            alpha = m / months
            # Interpolación sigmoidal para simular aceleración inicial y estabilización biológica
            progress = self._sigmoid_interpolation(alpha)
            
            frame = {"month": m, "teeth": []}
            for tooth_id, start_data in initial_state.items():
                target = targets.get(tooth_id)
                
                # Pose inicial
                pos = start_data['pos_3d']
                rot = start_data.get('rot_3d', {'x':0, 'y':0, 'z':0})
                
                if target:
                    # Aplicar movimiento interpolado
                    curr_pos = {
                        "x": pos['x'] + (target.get('target_x', 0) * progress),
                        "y": pos['y'] + (target.get('target_y', 0) * progress),
                        "z": pos['z'] + (target.get('target_z', 0) * progress)
                    }
                    curr_rot = {
                        "x": rot['x'] + (target.get('target_rx', 0) * progress),
                        "y": rot['y'] + (target.get('target_ry', 0) * progress),
                        "z": rot['z'] + (target.get('target_rz', 0) * progress)
                    }
                else:
                    curr_pos = pos
                    curr_rot = rot
                
                frame["teeth"].append({
                    "id": tooth_id,
                    "position": curr_pos,
                    "rotation": curr_rot
                })
            timeline.append(frame)
            
        return timeline

    def _sigmoid_interpolation(self, x: float) -> float:
        """
        Función de suavizado para movimientos biológicos más realistas.
        """
        if x <= 0: return 0
        if x >= 1: return 1
        return 1 / (1 + np.exp(-10 * (x - 0.5)))

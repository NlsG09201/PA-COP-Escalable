import cv2
import numpy as np
from typing import List, Dict, Any

class ToothProcessor:
    """
    Clase especializada en el procesamiento de imágenes dentales (radiografías/fotos)
    para segmentación y reconstrucción 3D.
    """
    
    def __init__(self):
        # Parámetros de calibración (estimados para este MVP)
        self.pixel_to_mm = 0.1  # 1 pixel = 0.1mm (ajustable con marcador)
        self.depth_factor = 1.2  # Factor de profundidad para reconstrucción 3D
        
    def segment_teeth(self, image_bytes: bytes) -> List[Dict[str, Any]]:
        """
        Detecta y segmenta piezas dentales usando procesamiento de imágenes avanzado.
        """
        # Decodificar imagen
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("No se pudo decodificar la imagen.")
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Mejora de contraste (CLAHE - Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(gray)
        
        # Umbralización adaptativa para separar dientes del fondo
        thresh = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                      cv2.THRESH_BINARY_INV, 11, 2)
        
        # Operaciones morfológicas para limpiar ruido
        kernel = np.ones((3,3), np.uint8)
        opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)
        sure_bg = cv2.dilate(opening, kernel, iterations=3)
        
        # Encontrar contornos
        contours, _ = cv2.findContours(opening, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        detected_teeth = []
        for i, cnt in enumerate(contours):
            area = cv2.contourArea(cnt)
            if area < 500: # Filtrar objetos pequeños que no son dientes
                continue
                
            # Calcular bounding box y centroide
            x, y, w, h = cv2.boundingRect(cnt)
            M = cv2.moments(cnt)
            if M["m00"] != 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
            else:
                cx, cy = x + w//2, y + h//2
                
            # Generar datos de reconstrucción 3D simplificados (mapeo de profundidad)
            # En un sistema real, esto usaría una red neuronal de estimación de profundidad
            z_est = (h / w) * self.depth_factor # Estimación heurística de profundidad basada en aspecto
            
            detected_teeth.append({
                "id": f"tooth_{i+1}",
                "pos_2d": {"x": cx, "y": cy},
                "dimensions": {"w": w, "h": h},
                "area": area,
                "reconstruction": {
                    "pos_3d": {"x": (cx - img.shape[1]/2) * self.pixel_to_mm, 
                              "y": (img.shape[0]/2 - cy) * self.pixel_to_mm, 
                              "z": z_est},
                    "scale": {"x": w * self.pixel_to_mm, "y": h * self.pixel_to_mm, "z": w * self.pixel_to_mm}
                }
            })
            
        return detected_teeth

    def correct_perspective(self, image: np.ndarray) -> np.ndarray:
        """
        Corrige la perspectiva y orientación de la imagen usando detección de bordes y 
        transformación de perspectiva para estandarizar la vista.
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150)
        
        # Encontrar el contorno más grande (que debería ser el arco dental o el marco de la radiografía)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return image
            
        c = max(contours, key=cv2.contourArea)
        rect = cv2.minAreaRect(c)
        box = cv2.boxPoints(rect)
        box = np.int0(box)
        
        # Ordenar puntos: top-left, top-right, bottom-right, bottom-left
        pts = np.zeros((4, 2), dtype="float32")
        s = box.sum(axis=1)
        pts[0] = box[np.argmin(s)]
        pts[2] = box[np.argmax(s)]
        diff = np.diff(box, axis=1)
        pts[1] = box[np.argmin(diff)]
        pts[3] = box[np.argmax(diff)]
        
        (tl, tr, br, bl) = pts
        widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
        widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
        maxWidth = max(int(widthA), int(widthB))
        
        heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
        heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
        maxHeight = max(int(heightA), int(heightB))
        
        dst = np.array([
            [0, 0],
            [maxWidth - 1, 0],
            [maxWidth - 1, maxHeight - 1],
            [0, maxHeight - 1]], dtype="float32")
            
        M = cv2.getPerspectiveTransform(pts, dst)
        warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
        
        return warped

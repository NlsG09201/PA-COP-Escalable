# Entrenamiento: detección FDI en intraorales

Esqueleto para **fine-tuning** de un detector de cajas + etiqueta FDI (32 piezas permanentes), alineado con las constantes del proyecto (`ortho_system/ia/processor.py`, backend Nest).

## Requisitos

- Python 3.10+
- GPU recomendable (CUDA/MPS); CPU válido solo para pruebas con pocas imágenes.
- Datos clínicos **anonimizados** y uso conforme a normativa local (RGPD / consentimiento).

## Estructura de datos

```
training/
  data/
    images/           # tus JPG/PNG (referenciados por ruta relativa)
    train.jsonl       # anotaciones (crear a partir de annotations.example.jsonl)
```

**Formato JSONL** (una línea JSON por imagen):

- `file`: ruta relativa bajo `images/` (ej. `caso001/foto1.jpg`).
- `width`, `height`: opcionales (informativos).
- `objects`: lista de `{ "fdi": "11", "bbox": [x1, y1, x2, y2] }` en **píxeles**, esquina superior izquierda / inferior derecha, sistema imagen.

FDI permitidos: los 32 de `fdi_labels.py` (`11`–`18`, `21`–`28`, `31`–`38`, `41`–`48`).

## Instalación

```bash
cd ortho_system/training
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements-train.txt
```

## Entrenar

```bash
python train_tooth_detection.py --images-dir data/images --train-jsonl data/train.jsonl --out runs/rcnn.pt --epochs 20 --batch-size 2
```

## Siguiente paso (integración)

Tras validar el modelo en tu conjunto:

1. Exportar a ONNX / TorchScript según entorno de inferencia.
2. En `AdvancedToothProcessor`, sustituir o combinar heurísticas por inferencia del detector (cajas → `pos_3d` como ahora).

El stub Image→3D en Docker sigue siendo la vía rápida para **malla GLB**; este entrenamiento mejora **detección por imagen** antes de reconstrucción.

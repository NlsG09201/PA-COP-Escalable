"""
Orden FDI permanente (32 piezas) alineado con `nest-migration` ortho-3d UPPER/LOWER.
Etiquetas de entrenamiento: 1..32 (PyTorch torchvision: 0 reservado a fondo en inferencia).
"""

# Sentido: desde el observador: cuadrantes 1-4, posiciones 1-8
UPPER_FDI: tuple[str, ...] = (
    "18",
    "17",
    "16",
    "15",
    "14",
    "13",
    "12",
    "11",
    "21",
    "22",
    "23",
    "24",
    "25",
    "26",
    "27",
    "28",
)
LOWER_FDI: tuple[str, ...] = (
    "48",
    "47",
    "46",
    "45",
    "44",
    "43",
    "42",
    "41",
    "31",
    "32",
    "33",
    "34",
    "35",
    "36",
    "37",
    "38",
)

STANDARD_FDI: tuple[str, ...] = UPPER_FDI + LOWER_FDI

# Faster R-CNN (torchvision): etiquetas 1..N; 0 es fondo implícito en target
FDI_TO_LABEL: dict[str, int] = {fdi: i + 1 for i, fdi in enumerate(STANDARD_FDI)}
LABEL_TO_FDI: dict[int, str] = {i + 1: fdi for i, fdi in enumerate(STANDARD_FDI)}

NUM_FD_CLASSES = len(STANDARD_FDI)

"""Entrenamiento offline del modelo J48 sklearn desde ARFF."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.ml.model_service import model_service


def main() -> None:
    result = model_service.train_and_persist()
    print("Entrenamiento completado:", result)


if __name__ == "__main__":
    main()

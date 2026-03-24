"""Load, initialise, and run inference with the dental EfficientNet ONNX model."""

from __future__ import annotations

import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np

logger = logging.getLogger(__name__)

DENTAL_CLASSES: List[str] = [
    "CARIES",
    "INFECTION",
    "WEAR",
    "FRACTURE",
    "PERIAPICAL_LESION",
    "HEALTHY",
]

CLASS_DESCRIPTIONS: Dict[str, str] = {
    "CARIES": "Lesión cariosa detectada — posible desmineralización del esmalte o dentina.",
    "INFECTION": "Signo de infección periapical o periodontal activa.",
    "WEAR": "Desgaste dental significativo, posiblemente por bruxismo o atrición.",
    "FRACTURE": "Línea de fractura detectada en estructura dental o radicular.",
    "PERIAPICAL_LESION": "Lesión periapical radiolúcida compatible con granuloma o quiste.",
    "HEALTHY": "No se detectan hallazgos patológicos relevantes.",
}


def _softmax(logits: np.ndarray) -> np.ndarray:
    """Numerically-stable softmax over the last axis."""
    shifted = logits - np.max(logits, axis=-1, keepdims=True)
    exp = np.exp(shifted)
    return exp / np.sum(exp, axis=-1, keepdims=True)


class DentalModelLoader:
    """Manages the lifecycle of the dental EfficientNet ONNX model.

    Responsibilities:
        * Loading an existing ONNX file **or** creating a fresh EfficientNetB0
          with a 6-class head and exporting it to ONNX.
        * Running inference and returning class probabilities.
        * Providing model metadata for the ``/model/info`` endpoint.
    """

    def __init__(self, model_path: str, device: str = "cpu") -> None:
        self.model_path = model_path
        self.device = device
        self.session = None
        self.loaded: bool = False
        self.model_version: str = "1.0.0"
        self.accuracy: float = 0.0
        self.last_trained: datetime | None = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load(self) -> None:
        """Load the ONNX model, creating a default one when the file is missing."""
        import onnxruntime as ort

        if not os.path.isfile(self.model_path):
            logger.warning(
                "ONNX weights not found at %s — generating default model.",
                self.model_path,
            )
            self._create_default_onnx()

        providers = ["CPUExecutionProvider"]
        if self.device != "cpu":
            providers.insert(0, "CUDAExecutionProvider")

        self.session = ort.InferenceSession(self.model_path, providers=providers)
        self.loaded = True
        logger.info("ONNX model loaded from %s (providers=%s).", self.model_path, providers)

    def predict(self, image_tensor: np.ndarray) -> List[Tuple[str, float]]:
        """Run inference and return ``[(class_label, confidence), ...]`` sorted desc by confidence."""
        if not self.loaded or self.session is None:
            raise RuntimeError("Model not loaded. Call load() first.")

        input_name = self.session.get_inputs()[0].name
        outputs = self.session.run(None, {input_name: image_tensor})
        logits = outputs[0]  # shape (1, num_classes)
        probs = _softmax(logits)[0]

        predictions: List[Tuple[str, float]] = [
            (DENTAL_CLASSES[i], float(probs[i])) for i in range(len(DENTAL_CLASSES))
        ]
        predictions.sort(key=lambda t: t[1], reverse=True)
        return predictions

    def get_info(self) -> dict:
        """Return metadata about the loaded model."""
        return {
            "version": self.model_version,
            "accuracy": self.accuracy,
            "classes": list(DENTAL_CLASSES),
            "last_trained": self.last_trained.isoformat() if self.last_trained else None,
            "device": self.device,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _create_default_onnx(self) -> None:
        """Build a fresh EfficientNetB0 with a 6-class head and export to ONNX."""
        import timm
        import torch
        import torch.nn as nn

        base = timm.create_model("efficientnet_b0", pretrained=False, num_classes=0)
        num_features = base.num_features

        class DentalEfficientNet(nn.Module):
            def __init__(self, backbone: nn.Module, in_features: int, n_classes: int) -> None:
                super().__init__()
                self.backbone = backbone
                self.head = nn.Sequential(
                    nn.Dropout(p=0.3),
                    nn.Linear(in_features, n_classes),
                )

            def forward(self, x: torch.Tensor) -> torch.Tensor:
                features = self.backbone(x)
                return self.head(features)

        model = DentalEfficientNet(base, num_features, len(DENTAL_CLASSES))
        model.eval()

        dummy_input = torch.randn(1, 3, 224, 224)

        weights_dir = Path(self.model_path).parent
        weights_dir.mkdir(parents=True, exist_ok=True)

        torch.onnx.export(
            model,
            dummy_input,
            self.model_path,
            input_names=["input"],
            output_names=["output"],
            dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
            opset_version=17,
        )
        logger.info("Default ONNX model exported to %s.", self.model_path)

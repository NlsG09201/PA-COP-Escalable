"""Load wav2vec2 feature extractor and ONNX emotion classifier."""

from __future__ import annotations

import logging
import os
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
import torch.nn as nn

logger = logging.getLogger(__name__)

EMOTION_CLASSES: list[str] = [
    "STRESS",
    "ANXIETY",
    "SADNESS",
    "ANGER",
    "CALM",
    "NEUTRAL",
    "JOY",
]

_WAV2VEC_DIM = 768


class _DefaultMLP(nn.Module):
    """Lightweight MLP used when no pre-trained ONNX weights are available."""

    def __init__(self, input_dim: int = _WAV2VEC_DIM, n_classes: int = len(EMOTION_CLASSES)):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, n_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class EmotionModelLoader:
    """Manages the wav2vec2 feature extractor and ONNX emotion classifier."""

    def __init__(self, wav2vec_model_name: str, onnx_path: str):
        self._wav2vec_model_name = wav2vec_model_name
        self._onnx_path = onnx_path
        self._feature_extractor = None
        self._wav2vec_model = None
        self._onnx_session: ort.InferenceSession | None = None
        self._device: str = "cpu"
        self._loaded = False
        self._wav2vec_loaded = False

    @property
    def loaded(self) -> bool:
        return self._loaded

    @property
    def wav2vec_loaded(self) -> bool:
        return self._wav2vec_loaded

    @property
    def device(self) -> str:
        return self._device

    def load(self) -> None:
        """Load wav2vec2 and the ONNX emotion classifier (or create a default one)."""
        self._device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info("Using device: %s", self._device)

        self._load_wav2vec()
        self._load_or_create_onnx()
        self._loaded = True
        logger.info("EmotionModelLoader fully initialised")

    def _load_wav2vec(self) -> None:
        from transformers import Wav2Vec2FeatureExtractor, Wav2Vec2Model

        logger.info("Loading wav2vec2 feature extractor: %s", self._wav2vec_model_name)
        self._feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(
            self._wav2vec_model_name
        )
        self._wav2vec_model = Wav2Vec2Model.from_pretrained(self._wav2vec_model_name)
        self._wav2vec_model.eval()
        self._wav2vec_model.to(self._device)
        self._wav2vec_loaded = True
        logger.info("wav2vec2 loaded successfully")

    def _load_or_create_onnx(self) -> None:
        onnx_file = Path(self._onnx_path)
        if onnx_file.exists():
            logger.info("Loading existing ONNX emotion classifier: %s", self._onnx_path)
            self._onnx_session = ort.InferenceSession(
                str(onnx_file),
                providers=["CPUExecutionProvider"],
            )
        else:
            logger.warning(
                "ONNX model not found at %s – creating default MLP with random weights",
                self._onnx_path,
            )
            self._export_default_onnx(onnx_file)
            self._onnx_session = ort.InferenceSession(
                str(onnx_file),
                providers=["CPUExecutionProvider"],
            )
        logger.info("ONNX emotion classifier ready")

    def _export_default_onnx(self, dest: Path) -> None:
        """Build a default MLP, randomise weights and export to ONNX."""
        dest.parent.mkdir(parents=True, exist_ok=True)
        model = _DefaultMLP()
        model.eval()
        dummy = torch.randn(1, _WAV2VEC_DIM)
        torch.onnx.export(
            model,
            dummy,
            str(dest),
            input_names=["input"],
            output_names=["output"],
            dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
            opset_version=17,
        )
        logger.info("Exported default ONNX model to %s", dest)

    def extract_embeddings(self, audio_np: np.ndarray, sr: int) -> np.ndarray:
        """Run wav2vec2 on raw audio and return a mean-pooled 768-dim embedding."""
        if self._feature_extractor is None or self._wav2vec_model is None:
            raise RuntimeError("wav2vec2 model not loaded – call load() first")

        inputs = self._feature_extractor(
            audio_np,
            sampling_rate=sr,
            return_tensors="pt",
            padding=True,
        )
        input_values = inputs.input_values.to(self._device)

        with torch.no_grad():
            outputs = self._wav2vec_model(input_values)

        hidden_states = outputs.last_hidden_state  # (1, T, 768)
        embeddings = hidden_states.mean(dim=1).squeeze(0).cpu().numpy()  # (768,)
        return embeddings.astype(np.float32)

    def predict(self, embeddings: np.ndarray) -> list[tuple[str, float]]:
        """Run ONNX inference and return sorted (label, confidence) pairs."""
        if self._onnx_session is None:
            raise RuntimeError("ONNX model not loaded – call load() first")

        if embeddings.ndim == 1:
            embeddings = embeddings.reshape(1, -1)

        logits = self._onnx_session.run(
            None,
            {"input": embeddings.astype(np.float32)},
        )[0]  # (batch, n_classes)

        probs = _softmax(logits[0])

        predictions = [
            (EMOTION_CLASSES[i], float(probs[i]))
            for i in range(len(EMOTION_CLASSES))
        ]
        predictions.sort(key=lambda x: x[1], reverse=True)
        return predictions


def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - np.max(x))
    return e / e.sum()

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import torch

from app.core.settings import settings

logger = logging.getLogger(__name__)


class DepthEstimator:
    def __init__(self) -> None:
        if settings.torch_num_threads and settings.torch_num_threads > 0:
            torch.set_num_threads(int(settings.torch_num_threads))

        self.device = self._resolve_device()
        self.model_name = settings.depth_model

        logger.info(
            "loading_depth_model",
            extra={"model": self.model_name, "device": self.device},
        )

        # Torch Hub cache is controlled via TORCH_HOME. This download happens once per container/volume.
        self.model: Any = torch.hub.load("intel-isl/MiDaS", self.model_name, trust_repo=True)
        self.model.to(self.device)
        self.model.eval()

        midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms", trust_repo=True)
        if self.model_name in ("DPT_Large", "DPT_Hybrid"):
            self.transform = midas_transforms.dpt_transform
        else:
            self.transform = midas_transforms.small_transform

        logger.info("depth_model_loaded", extra={"model": self.model_name})

    def _resolve_device(self) -> str:
        d = settings.device.strip().lower()
        if d in ("cpu", "cuda"):
            return d if d == "cpu" else ("cuda" if torch.cuda.is_available() else "cpu")
        return "cuda" if torch.cuda.is_available() else "cpu"

    @torch.inference_mode()
    def predict_depth(self, bgr_u8: np.ndarray) -> np.ndarray:
        """
        Returns depth as float32 HxW in arbitrary units (relative depth).
        """
        if bgr_u8.ndim != 3 or bgr_u8.shape[2] != 3:
            raise ValueError("image must be HxWx3 BGR uint8")
        img = bgr_u8[:, :, ::-1].copy()  # RGB
        inp = self.transform(img).to(self.device)
        pred = self.model(inp)
        pred = torch.nn.functional.interpolate(
            pred.unsqueeze(1),
            size=img.shape[:2],
            mode="bicubic",
            align_corners=False,
        ).squeeze()
        depth = pred.detach().float().cpu().numpy()
        return depth.astype(np.float32, copy=False)


_singleton: DepthEstimator | None = None


def get_depth_estimator() -> DepthEstimator:
    global _singleton
    if _singleton is None:
        _singleton = DepthEstimator()
    return _singleton


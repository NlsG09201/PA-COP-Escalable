"""Image preprocessing and augmentation utilities for dental radiograph analysis."""

from __future__ import annotations

import io
import random
from typing import List

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
INPUT_SIZE = 224


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """Convert raw image bytes into a normalised NCHW float32 tensor for inference.

    Pipeline:
        1. Decode bytes -> PIL Image (RGB)
        2. Resize to 224x224 with bicubic interpolation
        3. Scale pixel values to [0, 1]
        4. Normalise with ImageNet mean / std
        5. Transpose to NCHW and add batch dimension

    Returns:
        ``np.ndarray`` of shape ``(1, 3, 224, 224)`` with dtype ``float32``.
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((INPUT_SIZE, INPUT_SIZE), Image.BICUBIC)

    arr = np.array(img, dtype=np.float32) / 255.0
    arr = (arr - IMAGENET_MEAN) / IMAGENET_STD

    arr = arr.transpose(2, 0, 1)  # HWC -> CHW
    return np.expand_dims(arr, axis=0)  # add batch dim -> NCHW


def augment_image(image: Image.Image) -> List[Image.Image]:
    """Apply stochastic augmentations and return a list of augmented copies.

    Augmentations applied:
        * Random horizontal flip (50 %)
        * Random rotation between -15 and +15 degrees
        * Random brightness / contrast jitter
        * Optional slight Gaussian blur

    The original image is always included as the first element.
    """
    results: List[Image.Image] = [image.copy()]

    flipped = image.copy()
    if random.random() > 0.5:
        flipped = flipped.transpose(Image.FLIP_LEFT_RIGHT)
    results.append(flipped)

    angle = random.uniform(-15.0, 15.0)
    rotated = image.rotate(angle, resample=Image.BICUBIC, expand=False, fillcolor=(0, 0, 0))
    results.append(rotated)

    brightness_factor = random.uniform(0.8, 1.2)
    contrast_factor = random.uniform(0.8, 1.2)
    jittered = ImageEnhance.Brightness(image).enhance(brightness_factor)
    jittered = ImageEnhance.Contrast(jittered).enhance(contrast_factor)
    results.append(jittered)

    if random.random() > 0.5:
        blurred = image.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.5, 1.5)))
        results.append(blurred)

    return results

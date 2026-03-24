"""Training script for the dental EfficientNet classifier.

Usage (standalone)::

    python -m train.train_model --data-dir ./train/dataset --epochs 50 --lr 0.001

The same entry-point is called programmatically from
:meth:`DiagnosisService.start_training` when images reside in GridFS.
"""

from __future__ import annotations

import argparse
import io
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from sklearn.metrics import accuracy_score, classification_report, f1_score, precision_score, recall_score
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import DataLoader, Dataset

logger = logging.getLogger(__name__)

DENTAL_CLASSES: List[str] = [
    "CARIES",
    "INFECTION",
    "WEAR",
    "FRACTURE",
    "PERIAPICAL_LESION",
    "HEALTHY",
]
NUM_CLASSES = len(DENTAL_CLASSES)
LABEL_TO_IDX = {label: idx for idx, label in enumerate(DENTAL_CLASSES)}
INPUT_SIZE = 224

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


# ======================================================================
# Dataset
# ======================================================================


class DentalDataset(Dataset):
    """PyTorch ``Dataset`` for dental images loaded from a list of (image, label) pairs."""

    def __init__(
        self,
        samples: List[Tuple[Image.Image, int]],
        augment: bool = False,
    ) -> None:
        self.samples = samples
        self.augment = augment

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        img, label = self.samples[idx]
        img = img.convert("RGB").resize((INPUT_SIZE, INPUT_SIZE), Image.BICUBIC)

        if self.augment:
            img = self._apply_augmentation(img)

        arr = np.array(img, dtype=np.float32) / 255.0
        for c in range(3):
            arr[:, :, c] = (arr[:, :, c] - IMAGENET_MEAN[c]) / IMAGENET_STD[c]

        tensor = torch.from_numpy(arr.transpose(2, 0, 1))  # HWC -> CHW
        return tensor, label

    @staticmethod
    def _apply_augmentation(img: Image.Image) -> Image.Image:
        """Light stochastic augmentation applied during training."""
        import random
        from PIL import ImageEnhance

        if random.random() > 0.5:
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
        angle = random.uniform(-15.0, 15.0)
        img = img.rotate(angle, resample=Image.BICUBIC, expand=False, fillcolor=(0, 0, 0))
        img = ImageEnhance.Brightness(img).enhance(random.uniform(0.8, 1.2))
        img = ImageEnhance.Contrast(img).enhance(random.uniform(0.8, 1.2))
        return img


# ======================================================================
# Model builder
# ======================================================================


def build_model(num_classes: int = NUM_CLASSES, pretrained: bool = True) -> nn.Module:
    """Build an EfficientNetB0 backbone with a custom classification head."""
    import timm

    backbone = timm.create_model("efficientnet_b0", pretrained=pretrained, num_classes=0)
    num_features = backbone.num_features

    class DentalEfficientNet(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.backbone = backbone
            self.head = nn.Sequential(
                nn.Dropout(p=0.3),
                nn.Linear(num_features, num_classes),
            )

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            features = self.backbone(x)
            return self.head(features)

    return DentalEfficientNet()


# ======================================================================
# Data loading helpers
# ======================================================================


def load_samples_from_directory(data_dir: str) -> List[Tuple[Image.Image, int]]:
    """Load images from a directory organised as ``data_dir/<CLASS_NAME>/*.png``."""
    samples: List[Tuple[Image.Image, int]] = []
    root = Path(data_dir)

    for class_name in DENTAL_CLASSES:
        class_dir = root / class_name
        if not class_dir.is_dir():
            logger.warning("Class directory %s not found — skipping.", class_dir)
            continue
        for img_path in sorted(class_dir.iterdir()):
            if img_path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".bmp", ".tiff"}:
                continue
            try:
                img = Image.open(img_path).convert("RGB")
                samples.append((img, LABEL_TO_IDX[class_name]))
            except Exception:
                logger.warning("Could not load image %s — skipping.", img_path)

    logger.info("Loaded %d samples from %s.", len(samples), data_dir)
    return samples


def load_samples_from_gridfs(db, gridfs_bucket) -> List[Tuple[Image.Image, int]]:
    """Load training images previously uploaded via the ``/train/upload-dataset`` endpoint."""
    samples: List[Tuple[Image.Image, int]] = []
    cursor = db["training_images"].find()

    for doc in cursor:
        label_str = doc.get("label", "UNKNOWN")
        if label_str not in LABEL_TO_IDX:
            logger.warning("Unknown label '%s' for file %s — skipping.", label_str, doc.get("filename"))
            continue
        try:
            from bson import ObjectId

            grid_out = gridfs_bucket.get(ObjectId(doc["file_id"]))
            img = Image.open(io.BytesIO(grid_out.read())).convert("RGB")
            samples.append((img, LABEL_TO_IDX[label_str]))
        except Exception:
            logger.warning("Could not load GridFS file %s — skipping.", doc.get("file_id"))

    logger.info("Loaded %d samples from GridFS.", len(samples))
    return samples


# ======================================================================
# Training loop
# ======================================================================


def _compute_class_weights(labels: List[int]) -> torch.Tensor:
    """Inverse-frequency weighting to handle class imbalance."""
    counts = np.bincount(labels, minlength=NUM_CLASSES).astype(np.float32)
    counts = np.maximum(counts, 1.0)
    weights = 1.0 / counts
    weights = weights / weights.sum() * NUM_CLASSES
    return torch.from_numpy(weights)


def train(
    samples: List[Tuple[Image.Image, int]],
    model_path: str,
    epochs: int = 50,
    lr: float = 0.001,
    batch_size: int = 32,
    val_split: float = 0.2,
    patience: int = 7,
    device_str: str = "cpu",
) -> Dict[str, Any]:
    """Full training pipeline with validation, early stopping, and ONNX export.

    Returns a dict of final metrics.
    """
    import random as stdlib_random

    stdlib_random.shuffle(samples)
    split_idx = max(1, int(len(samples) * (1 - val_split)))
    train_samples = samples[:split_idx]
    val_samples = samples[split_idx:]

    logger.info("Train samples: %d | Val samples: %d", len(train_samples), len(val_samples))

    train_ds = DentalDataset(train_samples, augment=True)
    val_ds = DentalDataset(val_samples, augment=False)

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0)

    device = torch.device(device_str)
    model = build_model(pretrained=True).to(device)

    train_labels = [s[1] for s in train_samples]
    class_weights = _compute_class_weights(train_labels).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    optimizer = AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = CosineAnnealingLR(optimizer, T_max=epochs, eta_min=lr * 0.01)

    best_val_loss = float("inf")
    best_state = None
    epochs_no_improve = 0

    for epoch in range(1, epochs + 1):
        # --- Training ---
        model.train()
        running_loss = 0.0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * images.size(0)

        scheduler.step()
        avg_train_loss = running_loss / max(len(train_ds), 1)

        # --- Validation ---
        model.eval()
        val_loss = 0.0
        all_preds: List[int] = []
        all_labels: List[int] = []

        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                loss = criterion(outputs, labels)
                val_loss += loss.item() * images.size(0)
                preds = outputs.argmax(dim=1).cpu().tolist()
                all_preds.extend(preds)
                all_labels.extend(labels.cpu().tolist())

        avg_val_loss = val_loss / max(len(val_ds), 1)
        val_acc = accuracy_score(all_labels, all_preds) if all_labels else 0.0

        logger.info(
            "Epoch %d/%d — train_loss=%.4f  val_loss=%.4f  val_acc=%.4f",
            epoch,
            epochs,
            avg_train_loss,
            avg_val_loss,
            val_acc,
        )

        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            epochs_no_improve = 0
        else:
            epochs_no_improve += 1
            if epochs_no_improve >= patience:
                logger.info("Early stopping at epoch %d (patience=%d).", epoch, patience)
                break

    # --- Restore best weights ---
    if best_state is not None:
        model.load_state_dict(best_state)

    # --- Final evaluation ---
    model.eval()
    final_preds: List[int] = []
    final_labels: List[int] = []
    with torch.no_grad():
        for images, labels in val_loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            final_preds.extend(outputs.argmax(dim=1).cpu().tolist())
            final_labels.extend(labels.cpu().tolist())

    metrics: Dict[str, Any] = {}
    if final_labels:
        metrics["accuracy"] = float(accuracy_score(final_labels, final_preds))
        metrics["precision_macro"] = float(precision_score(final_labels, final_preds, average="macro", zero_division=0))
        metrics["recall_macro"] = float(recall_score(final_labels, final_preds, average="macro", zero_division=0))
        metrics["f1_macro"] = float(f1_score(final_labels, final_preds, average="macro", zero_division=0))
        metrics["classification_report"] = classification_report(
            final_labels,
            final_preds,
            target_names=DENTAL_CLASSES,
            zero_division=0,
            output_dict=True,
        )
    else:
        metrics["accuracy"] = 0.0
        metrics["note"] = "No validation samples available."

    # --- Export to ONNX ---
    model.to("cpu")
    dummy = torch.randn(1, 3, INPUT_SIZE, INPUT_SIZE)
    weights_dir = Path(model_path).parent
    weights_dir.mkdir(parents=True, exist_ok=True)

    torch.onnx.export(
        model,
        dummy,
        model_path,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
        opset_version=17,
    )
    logger.info("Model exported to %s.", model_path)

    metrics["model_path"] = model_path
    metrics["exported_at"] = datetime.now(tz=timezone.utc).isoformat()
    return metrics


# ======================================================================
# GridFS-backed entry-point (called by DiagnosisService)
# ======================================================================


def run_training_from_gridfs(
    db,
    gridfs_bucket,
    model_path: str,
    epochs: int = 10,
    lr: float = 0.001,
    batch_size: int = 32,
) -> Dict[str, Any]:
    """Load training data from GridFS, train the model, and return metrics."""
    samples = load_samples_from_gridfs(db, gridfs_bucket)
    if not samples:
        raise RuntimeError("No training images found in GridFS.")

    metrics = train(
        samples=samples,
        model_path=model_path,
        epochs=epochs,
        lr=lr,
        batch_size=batch_size,
    )

    db["training_runs"].update_one(
        {"model_path": model_path},
        {
            "$set": {
                "metrics": metrics,
                "completed_at": datetime.now(tz=timezone.utc),
            }
        },
        upsert=True,
    )
    return metrics


# ======================================================================
# CLI entry-point
# ======================================================================


def main() -> None:
    """Parse CLI arguments and run training from a local directory."""
    parser = argparse.ArgumentParser(description="Train the dental EfficientNet classifier.")
    parser.add_argument("--data-dir", type=str, required=True, help="Root directory with class sub-folders.")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs.")
    parser.add_argument("--lr", type=float, default=0.001, help="Initial learning rate.")
    parser.add_argument("--batch-size", type=int, default=32, help="Mini-batch size.")
    parser.add_argument("--output", type=str, default="app/ml/weights/dental_efficientnet.onnx", help="ONNX output path.")
    parser.add_argument("--device", type=str, default="cpu", help="Training device (cpu or cuda).")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s — %(message)s")

    samples = load_samples_from_directory(args.data_dir)
    if not samples:
        logger.error("No samples found in %s. Expected sub-folders: %s", args.data_dir, DENTAL_CLASSES)
        sys.exit(1)

    metrics = train(
        samples=samples,
        model_path=args.output,
        epochs=args.epochs,
        lr=args.lr,
        batch_size=args.batch_size,
        device_str=args.device,
    )

    logger.info("Training complete. Metrics: %s", {k: v for k, v in metrics.items() if k != "classification_report"})


if __name__ == "__main__":
    main()

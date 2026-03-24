"""Training script for the emotion classifier MLP.

Usage:
    python -m train.train_model --data-dir ./train/dataset --epochs 30

Expected dataset layout (``--data-dir``):
    labels.csv   – columns: filename, emotion  (emotion is one of EMOTION_CLASSES)
    *.wav        – audio files referenced by *filename* in the CSV
"""

from __future__ import annotations

import argparse
import csv
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
from sklearn.model_selection import StratifiedKFold
from sklearn.utils.class_weight import compute_class_weight
from torch.optim.lr_scheduler import ReduceLROnPlateau
from torch.utils.data import DataLoader, TensorDataset

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

EMOTION_CLASSES = ["STRESS", "ANXIETY", "SADNESS", "ANGER", "CALM", "NEUTRAL", "JOY"]
_LABEL2IDX = {lbl: idx for idx, lbl in enumerate(EMOTION_CLASSES)}
_WAV2VEC_DIM = 768


class _MLP(nn.Module):
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


def _load_wav2vec(model_name: str = "facebook/wav2vec2-base"):
    from transformers import Wav2Vec2FeatureExtractor, Wav2Vec2Model

    logger.info("Loading wav2vec2: %s", model_name)
    extractor = Wav2Vec2FeatureExtractor.from_pretrained(model_name)
    model = Wav2Vec2Model.from_pretrained(model_name)
    model.eval()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    return extractor, model, device


def _extract_embedding(
    audio_path: str,
    extractor,
    model,
    device: str,
    target_sr: int = 16_000,
) -> Optional[np.ndarray]:
    import librosa

    try:
        audio, sr = librosa.load(audio_path, sr=target_sr, mono=True)
        inputs = extractor(audio, sampling_rate=target_sr, return_tensors="pt", padding=True)
        input_values = inputs.input_values.to(device)
        with torch.no_grad():
            outputs = model(input_values)
        hidden = outputs.last_hidden_state
        emb = hidden.mean(dim=1).squeeze(0).cpu().numpy().astype(np.float32)
        return emb
    except Exception:
        logger.exception("Failed to extract embedding from %s", audio_path)
        return None


def _load_dataset(data_dir: str, extractor, model, device: str):
    labels_csv = os.path.join(data_dir, "labels.csv")
    if not os.path.isfile(labels_csv):
        raise FileNotFoundError(f"labels.csv not found in {data_dir}")

    embeddings: list[np.ndarray] = []
    labels: list[int] = []

    with open(labels_csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            filename = row["filename"]
            emotion = row["emotion"].strip().upper()
            if emotion not in _LABEL2IDX:
                logger.warning("Skipping unknown emotion '%s' for %s", emotion, filename)
                continue

            audio_path = os.path.join(data_dir, filename)
            if not os.path.isfile(audio_path):
                logger.warning("Audio file not found: %s", audio_path)
                continue

            emb = _extract_embedding(audio_path, extractor, model, device)
            if emb is None:
                continue

            embeddings.append(emb)
            labels.append(_LABEL2IDX[emotion])

    if not embeddings:
        raise RuntimeError("No valid samples loaded")

    X = np.stack(embeddings)
    y = np.array(labels, dtype=np.int64)
    logger.info("Dataset loaded: %d samples, %d classes", len(y), len(set(y.tolist())))
    return X, y


def _train_fold(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
    class_weights: np.ndarray,
    epochs: int,
    lr: float,
    device: str,
) -> tuple[_MLP, float]:
    model = _MLP().to(device)
    weight_tensor = torch.tensor(class_weights, dtype=torch.float32).to(device)
    criterion = nn.CrossEntropyLoss(weight=weight_tensor)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=3)

    train_ds = TensorDataset(
        torch.tensor(X_train, dtype=torch.float32),
        torch.tensor(y_train, dtype=torch.long),
    )
    val_ds = TensorDataset(
        torch.tensor(X_val, dtype=torch.float32),
        torch.tensor(y_val, dtype=torch.long),
    )
    train_loader = DataLoader(train_ds, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=64, shuffle=False)

    best_val_acc = 0.0
    best_state = None

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for xb, yb in train_loader:
            xb, yb = xb.to(device), yb.to(device)
            optimizer.zero_grad()
            logits = model(xb)
            loss = criterion(logits, yb)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(xb)

        avg_loss = total_loss / len(train_ds)

        model.eval()
        correct = 0
        val_loss = 0.0
        with torch.no_grad():
            for xb, yb in val_loader:
                xb, yb = xb.to(device), yb.to(device)
                logits = model(xb)
                val_loss += criterion(logits, yb).item() * len(xb)
                preds = logits.argmax(dim=1)
                correct += (preds == yb).sum().item()

        val_acc = correct / len(val_ds) if len(val_ds) > 0 else 0.0
        avg_val_loss = val_loss / len(val_ds) if len(val_ds) > 0 else 0.0
        scheduler.step(avg_val_loss)

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}

        if epoch % 5 == 0 or epoch == 1:
            logger.info(
                "  Epoch %3d/%d  loss=%.4f  val_loss=%.4f  val_acc=%.4f",
                epoch,
                epochs,
                avg_loss,
                avg_val_loss,
                val_acc,
            )

    if best_state is not None:
        model.load_state_dict(best_state)

    return model, best_val_acc


def _export_onnx(model: _MLP, dest: str) -> None:
    model.eval()
    model.cpu()
    dummy = torch.randn(1, _WAV2VEC_DIM)
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    torch.onnx.export(
        model,
        dummy,
        dest,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
        opset_version=17,
    )
    logger.info("ONNX model exported to %s", dest)


def _save_metrics_to_mongo(
    fold_accs: list[float],
    mean_acc: float,
    epochs: int,
    data_dir: str,
) -> None:
    try:
        import pymongo

        from app.config import settings

        client = pymongo.MongoClient(settings.MONGODB_URI)
        db = client[settings.MONGODB_DB]
        db["emotion_model_meta"].insert_one(
            {
                "trained_at": datetime.now(timezone.utc),
                "epochs": epochs,
                "data_dir": data_dir,
                "fold_accuracies": fold_accs,
                "mean_accuracy": mean_acc,
                "classes": EMOTION_CLASSES,
                "model_version": "1.0.0",
            }
        )
        client.close()
        logger.info("Saved training metrics to MongoDB")
    except Exception:
        logger.warning("Could not save metrics to MongoDB", exc_info=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train emotion classifier MLP")
    parser.add_argument("--data-dir", required=True, help="Directory with labels.csv + wav files")
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--folds", type=int, default=5)
    parser.add_argument("--output", default="app/ml/weights/emotion_classifier.onnx")
    parser.add_argument("--wav2vec-model", default="facebook/wav2vec2-base")
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info("Device: %s", device)

    extractor, wav2vec, w2v_device = _load_wav2vec(args.wav2vec_model)
    X, y = _load_dataset(args.data_dir, extractor, wav2vec, w2v_device)

    unique_classes = np.unique(y)
    class_weights = compute_class_weight("balanced", classes=unique_classes, y=y)
    full_weights = np.ones(len(EMOTION_CLASSES), dtype=np.float32)
    for idx, cls in enumerate(unique_classes):
        full_weights[cls] = class_weights[idx]

    n_folds = min(args.folds, len(unique_classes), len(y))
    if n_folds < 2:
        logger.warning("Too few samples for cross-validation – training on full dataset")
        model, acc = _train_fold(X, y, X, y, full_weights, args.epochs, args.lr, device)
        fold_accs = [acc]
    else:
        skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42)
        fold_accs: list[float] = []
        best_model: Optional[_MLP] = None
        best_acc = 0.0

        for fold_idx, (train_idx, val_idx) in enumerate(skf.split(X, y), 1):
            logger.info("=== Fold %d/%d ===", fold_idx, n_folds)
            model, acc = _train_fold(
                X[train_idx],
                y[train_idx],
                X[val_idx],
                y[val_idx],
                full_weights,
                args.epochs,
                args.lr,
                device,
            )
            fold_accs.append(acc)
            if acc > best_acc:
                best_acc = acc
                best_model = model

        model = best_model  # type: ignore[assignment]

    mean_acc = float(np.mean(fold_accs))
    logger.info("Cross-val accuracies: %s", [f"{a:.4f}" for a in fold_accs])
    logger.info("Mean accuracy: %.4f", mean_acc)

    _export_onnx(model, args.output)
    _save_metrics_to_mongo(fold_accs, mean_acc, args.epochs, args.data_dir)
    logger.info("Training complete")


if __name__ == "__main__":
    main()

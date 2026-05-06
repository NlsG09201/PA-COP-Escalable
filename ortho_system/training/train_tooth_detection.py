"""
Fine-tuning Faster R-CNN para cajas + clase FDI en fotos intraorales.

Entrada: JSONL (una línea por imagen) + carpeta de imágenes.
Ver README.md en este directorio.

Ejemplo:
  pip install -r requirements-train.txt
  python train_tooth_detection.py --images-dir data/images --train-jsonl data/train.jsonl --out runs/rcnn.pt
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision.models.detection import fasterrcnn_resnet50_fpn
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor
from torchvision.transforms import functional as F_t
from tqdm import tqdm

from fdi_labels import FDI_TO_LABEL, NUM_FD_CLASSES


# num_classes torchvision = fondo + clases; etiquetas en target son 1..NUM_FD_CLASSES
NUM_MODEL_CLASSES = NUM_FD_CLASSES + 1


def _load_jsonl_records(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            rows.append(json.loads(line))
    return rows


class IntraoralJsonlDataset(Dataset):
    """Cada registro: {\"file\": \"rel/path.jpg\", \"objects\": [{\"fdi\": \"11\", \"bbox\": [x1,y1,x2,y2]}, ...]}"""

    def __init__(self, images_root: Path, jsonl_path: Path):
        self.images_root = images_root
        self.entries: list[tuple[Path, list[list[float]], list[int]]] = []
        for rec in _load_jsonl_records(jsonl_path):
            rel = rec.get("file")
            if not rel:
                continue
            img_path = self.images_root / str(rel)
            if not img_path.is_file():
                continue
            boxes: list[list[float]] = []
            labels: list[int] = []
            for o in rec.get("objects") or []:
                fdi = str(o.get("fdi", "")).strip()
                if fdi not in FDI_TO_LABEL:
                    continue
                bb = o.get("bbox")
                if not bb or len(bb) != 4:
                    continue
                x1, y1, x2, y2 = (float(bb[0]), float(bb[1]), float(bb[2]), float(bb[3]))
                if x2 <= x1 or y2 <= y1:
                    continue
                boxes.append([x1, y1, x2, y2])
                labels.append(FDI_TO_LABEL[fdi])
            if not boxes:
                continue
            self.entries.append((img_path, boxes, labels))

    def __len__(self) -> int:
        return len(self.entries)

    def __getitem__(self, idx: int):
        path, boxes, labels = self.entries[idx]
        img = Image.open(path).convert("RGB")
        img_t = F_t.to_tensor(img)
        boxes_t = torch.tensor(boxes, dtype=torch.float32)
        labels_t = torch.tensor(labels, dtype=torch.int64)
        target = {
            "boxes": boxes_t,
            "labels": labels_t,
            "image_id": torch.tensor([idx]),
            "area": (boxes_t[:, 3] - boxes_t[:, 1]) * (boxes_t[:, 2] - boxes_t[:, 0]),
            "iscrowd": torch.zeros(len(boxes), dtype=torch.int64),
        }
        return img_t, target


def collate_detection(batch):
    return tuple(zip(*batch))


def build_model() -> torch.nn.Module:
    model = fasterrcnn_resnet50_fpn(weights="DEFAULT")
    in_features = model.roi_heads.box_predictor.cls_score.in_features
    model.roi_heads.box_predictor = FastRCNNPredictor(in_features, NUM_MODEL_CLASSES)
    return model


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Entrenar detector FDI intraoral (Faster R-CNN)")
    p.add_argument("--images-dir", type=Path, required=True, help="Raíz de imágenes (paths relativos en JSONL)")
    p.add_argument("--train-jsonl", type=Path, required=True)
    p.add_argument("--epochs", type=int, default=15)
    p.add_argument("--batch-size", type=int, default=2, help="Typical 1-4 según VRAM")
    p.add_argument("--lr", type=float, default=0.005)
    p.add_argument("--device", default=None, help="cuda / cpu / mps")
    p.add_argument("--out", type=Path, default=Path("runs/tooth_rcnn.pt"))
    return p.parse_args()


def main() -> None:
    args = parse_args()
    device_s = args.device or ("cuda" if torch.cuda.is_available() else "cpu")
    if device_s == "mps" and torch.backends.mps.is_available():
        device = torch.device("mps")
    else:
        device = torch.device(device_s)

    ds_train = IntraoralJsonlDataset(args.images_dir, args.train_jsonl)
    if len(ds_train) == 0:
        print("No hay muestras válidas: revisa rutas en JSONL y carpeta --images-dir.", file=sys.stderr)
        sys.exit(1)

    loader_train = DataLoader(
        ds_train,
        batch_size=args.batch_size,
        shuffle=True,
        collate_fn=collate_detection,
        num_workers=0,
    )

    model = build_model().to(device)
    params = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.SGD(params, lr=args.lr, momentum=0.9, weight_decay=1e-4)

    args.out.parent.mkdir(parents=True, exist_ok=True)

    model.train()
    for epoch in range(args.epochs):
        epoch_loss = 0.0
        n_batches = 0
        for images, targets in tqdm(loader_train, desc=f"epoch {epoch+1}/{args.epochs}"):
            images = [im.to(device) for im in images]
            targets = [{k: v.to(device) for k, v in t.items()} for t in targets]

            loss_dict = model(images, targets)
            losses = sum(loss_dict.values())

            optimizer.zero_grad()
            losses.backward()
            optimizer.step()

            epoch_loss += float(losses.item())
            n_batches += 1

        avg = epoch_loss / max(n_batches, 1)
        print(f"epoch {epoch+1} train_loss={avg:.4f}")

    torch.save(
        {
            "model_state": model.state_dict(),
            "num_classes": NUM_MODEL_CLASSES,
            "fdi_label_map": FDI_TO_LABEL,
        },
        args.out,
    )
    print(f"Guardado: {args.out}")


if __name__ == "__main__":
    main()

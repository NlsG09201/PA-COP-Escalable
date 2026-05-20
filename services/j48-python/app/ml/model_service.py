from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.tree import DecisionTreeClassifier, export_text

from app.config import settings
from app.ml.arff_loader import load_arff

logger = logging.getLogger(__name__)

FEATURE_ORDER = [
    "gender",
    "age_group",
    "sentiment",
    "wellbeing",
    "anxiety",
    "depression",
    "attendance",
    "days_since_last",
]
CLASS_LABELS = ["LOW", "MEDIUM", "HIGH"]


class J48ModelService:
    def __init__(self) -> None:
        self._pipeline: Pipeline | None = None
        self._class_labels: list[str] = CLASS_LABELS
        self._metrics: dict[str, Any] = {}
        self._tree_text: str = ""

    @property
    def ready(self) -> bool:
        return self._pipeline is not None

    def init(self) -> None:
        model_path = Path(settings.model_path)
        if model_path.exists():
            payload = joblib.load(model_path)
            self._pipeline = payload["pipeline"]
            self._class_labels = list(payload.get("class_labels", CLASS_LABELS))
            self._metrics = dict(payload.get("metrics", {}))
            self._tree_text = str(payload.get("tree_text", ""))
            logger.info("Modelo J48 sklearn cargado desde %s", model_path)
            return
        if not settings.auto_train:
            raise RuntimeError(f"Modelo no encontrado y auto_train=false: {model_path}")
        self.train_and_persist()

    def train_and_persist(self) -> dict[str, Any]:
        arff = Path(settings.arff_path)
        if not arff.exists():
            raise FileNotFoundError(f"ARFF no encontrado: {arff}")

        df, feature_cols, class_cols = load_arff(arff)
        target_col = class_cols[0]
        X = df[feature_cols]
        y = df[target_col].astype(str)

        nominal = [c for c in feature_cols if c not in ("anxiety", "depression", "days_since_last")]
        numeric = [c for c in feature_cols if c in ("anxiety", "depression", "days_since_last")]

        preprocessor = ColumnTransformer(
            transformers=[
                ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), nominal),
                ("num", "passthrough", numeric),
            ]
        )

        clf = DecisionTreeClassifier(
            criterion="entropy",
            max_depth=settings.max_depth,
            min_samples_leaf=settings.min_samples_leaf,
            random_state=settings.random_state,
            class_weight="balanced",
        )

        pipeline = Pipeline([("prep", preprocessor), ("clf", clf)])

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=settings.random_state, stratify=y
        )
        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)

        acc = float(accuracy_score(y_test, y_pred))
        f1 = float(f1_score(y_test, y_pred, average="weighted"))
        report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)

        tree = pipeline.named_steps["clf"]
        tree_text = export_text(tree, max_depth=6)

        self._pipeline = pipeline
        self._class_labels = sorted(y.unique().tolist(), key=lambda x: CLASS_LABELS.index(x) if x in CLASS_LABELS else 99)
        self._metrics = {"accuracy": acc, "f1_weighted": f1, "report": report, "trained_on": int(len(df))}
        self._tree_text = tree_text

        model_path = Path(settings.model_path)
        model_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {
                "pipeline": pipeline,
                "class_labels": self._class_labels,
                "metrics": self._metrics,
                "tree_text": tree_text,
                "feature_order": FEATURE_ORDER,
            },
            model_path,
        )

        return {
            "ok": True,
            "trainedOn": len(df),
            "attributes": len(feature_cols) + 1,
            "classAttribute": target_col,
            "modelPath": str(model_path),
            "accuracy": acc,
            "f1_weighted": f1,
        }

    def _row_from_features(self, features: dict[str, Any]) -> pd.DataFrame:
        row: dict[str, Any] = {}
        for key in FEATURE_ORDER:
            val = features.get(key)
            if val is None:
                row[key] = np.nan
            elif key in ("anxiety", "depression", "days_since_last"):
                try:
                    row[key] = float(val)
                except (TypeError, ValueError):
                    row[key] = np.nan
            else:
                row[key] = str(val)
        return pd.DataFrame([row])

    def predict(self, features: dict[str, Any]) -> dict[str, Any]:
        if not self._pipeline:
            raise RuntimeError("Modelo no cargado")
        X = self._row_from_features(features)
        pipeline = self._pipeline
        clf: DecisionTreeClassifier = pipeline.named_steps["clf"]
        proba = pipeline.predict_proba(X)[0]
        classes = list(clf.classes_)
        idx = int(np.argmax(proba))
        class_label = classes[idx]

        probabilities = {str(classes[i]): float(proba[i]) for i in range(len(classes))}
        risk_score = self._risk_score(class_label, probabilities)

        return {
            "classLabel": class_label,
            "classIndex": idx,
            "probabilities": probabilities,
            "riskScore": risk_score,
            "alertLevel": self._alert_level(class_label, risk_score),
            "recommendations": self._recommendations(class_label, features),
        }

    def _risk_score(self, label: str, probs: dict[str, float]) -> float:
        weights = {"LOW": 0.2, "MEDIUM": 0.55, "HIGH": 0.9}
        return round(sum(weights.get(k, 0.5) * v for k, v in probs.items()), 4)

    def _alert_level(self, label: str, score: float) -> str:
        if label == "HIGH" or score >= 0.75:
            return "CRITICAL"
        if label == "MEDIUM" or score >= 0.45:
            return "WARNING"
        return "NORMAL"

    def _recommendations(self, label: str, features: dict[str, Any]) -> list[str]:
        recs: list[str] = []
        if label in ("MEDIUM", "HIGH"):
            recs.append("Programar sesión de seguimiento en los próximos 7 días.")
        if str(features.get("attendance")) == "IRREGULAR":
            recs.append("Reforzar adherencia terapéutica con recordatorios automáticos.")
        anxiety = float(features.get("anxiety") or 0)
        depression = float(features.get("depression") or 0)
        if anxiety >= 0.7:
            recs.append("Evaluar escalas de ansiedad (GAD-7) y técnicas de regulación emocional.")
        if depression >= 0.7:
            recs.append("Valorar interconsulta psiquiátrica y plan de crisis.")
        if not recs:
            recs.append("Continuar plan terapéutico actual; próxima evaluación en 30 días.")
        return recs

    def info(self) -> dict[str, Any]:
        if not self.ready:
            return {"ready": False}
        return {
            "ready": True,
            "engine": "scikit-learn DecisionTreeClassifier (entropy)",
            "attributes": len(FEATURE_ORDER) + 1,
            "classAttribute": "risk_level",
            "classLabels": self._class_labels,
            "metrics": self._metrics,
        }

    def tree_visualization(self) -> dict[str, Any]:
        return {
            "treeText": self._tree_text,
            "metrics": self._metrics,
            "classLabels": self._class_labels,
        }

    def metrics_export(self) -> str:
        return json.dumps(self._metrics, indent=2, default=str)


model_service = J48ModelService()

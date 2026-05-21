from __future__ import annotations

import json
import logging
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.tree import DecisionTreeClassifier, export_text

from app.config import settings
from app.ml.dataset_loader import (
    column_stats,
    dataset_preview,
    infer_column_types,
    load_csv_bytes,
    load_dataset_file,
)
from app.ml.tree_json import export_tree_json

logger = logging.getLogger(__name__)

CLINICAL_FEATURE_HINTS = [
    "gender",
    "age_group",
    "sentiment",
    "wellbeing",
    "anxiety",
    "depression",
    "attendance",
    "days_since_last",
    "stress",
    "adherence",
    "relapse",
    "risk_level",
]


class WekaLabService:
    def __init__(self) -> None:
        self._lab_root = Path(settings.lab_data_dir)
        self._datasets_dir = self._lab_root / "datasets"
        self._models_dir = self._lab_root / "models"
        self._datasets_dir.mkdir(parents=True, exist_ok=True)
        self._models_dir.mkdir(parents=True, exist_ok=True)
        self._active_model_id: str | None = None

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def list_datasets(self) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for meta_path in sorted(self._datasets_dir.glob("*/meta.json")):
            try:
                out.append(json.loads(meta_path.read_text(encoding="utf-8")))
            except Exception:
                continue
        return sorted(out, key=lambda x: x.get("uploadedAt", ""), reverse=True)

    def upload_dataset(self, content: bytes, filename: str, display_name: str | None = None) -> dict[str, Any]:
        dataset_id = str(uuid.uuid4())
        folder = self._datasets_dir / dataset_id
        folder.mkdir(parents=True, exist_ok=True)
        safe_name = Path(filename).name
        dest = folder / safe_name
        dest.write_bytes(content)

        if safe_name.lower().endswith(".csv"):
            df, default_features, default_target = load_csv_bytes(content, safe_name)
        else:
            df, default_features, default_target = load_dataset_file(dest)

        meta = {
            "id": dataset_id,
            "filename": safe_name,
            "displayName": display_name or safe_name,
            "format": safe_name.split(".")[-1].lower(),
            "rows": int(len(df)),
            "columns": list(df.columns),
            "defaultTarget": default_target,
            "defaultFeatures": default_features,
            "columnTypes": infer_column_types(df, default_features),
            "columnStats": column_stats(df),
            "preview": dataset_preview(df),
            "uploadedAt": self._now(),
        }
        (folder / "meta.json").write_text(json.dumps(meta, indent=2, default=str), encoding="utf-8")
        df.to_csv(folder / "normalized.csv", index=False)
        return meta

    def get_dataset(self, dataset_id: str) -> dict[str, Any]:
        meta_path = self._datasets_dir / dataset_id / "meta.json"
        if not meta_path.exists():
            raise FileNotFoundError(f"Dataset no encontrado: {dataset_id}")
        return json.loads(meta_path.read_text(encoding="utf-8"))

    def _load_dataset_df(self, dataset_id: str) -> pd.DataFrame:
        csv_path = self._datasets_dir / dataset_id / "normalized.csv"
        if not csv_path.exists():
            raise FileNotFoundError(f"Dataset sin datos normalizados: {dataset_id}")
        return pd.read_csv(csv_path)

    def train_model(self, config: dict[str, Any]) -> dict[str, Any]:
        dataset_id = str(config.get("datasetId") or "")
        if not dataset_id:
            arff = Path(settings.arff_path)
            if arff.exists():
                dataset_id = "builtin-arff"
                folder = self._datasets_dir / dataset_id
                if not (folder / "meta.json").exists():
                    raw = arff.read_bytes()
                    self.upload_dataset(raw, arff.name, "ARFF clínico por defecto")
            else:
                raise ValueError("datasetId requerido")

        df = self._load_dataset_df(dataset_id)
        target_col = str(config.get("targetColumn") or self.get_dataset(dataset_id)["defaultTarget"])
        feature_cols = list(config.get("featureColumns") or self.get_dataset(dataset_id)["defaultFeatures"])
        feature_cols = [c for c in feature_cols if c in df.columns and c != target_col]
        if not feature_cols:
            raise ValueError("Seleccione al menos una variable predictora")

        X = df[feature_cols].copy()
        y = df[target_col].astype(str)

        col_types = infer_column_types(df, feature_cols)
        nominal = [c for c in feature_cols if col_types.get(c) == "nominal"]
        numeric = [c for c in feature_cols if col_types.get(c) == "numeric"]

        test_size = float(config.get("testSize") or 0.2)
        test_size = min(0.5, max(0.1, test_size))
        max_depth = config.get("maxDepth")
        max_depth = int(max_depth) if max_depth not in (None, "", 0) else None
        min_samples_leaf = int(config.get("minSamplesLeaf") or settings.min_samples_leaf)
        min_samples_split = int(config.get("minSamplesSplit") or 2)
        ccp_alpha = float(config.get("ccpAlpha") or 0.0)
        cv_folds = int(config.get("cvFolds") or 5)
        cv_folds = max(2, min(10, cv_folds))
        random_state = int(config.get("randomState") or settings.random_state)

        preprocessor = ColumnTransformer(
            transformers=[
                ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), nominal),
                ("num", "passthrough", numeric),
            ],
            remainder="drop",
        )

        clf = DecisionTreeClassifier(
            criterion="entropy",
            max_depth=max_depth,
            min_samples_leaf=min_samples_leaf,
            min_samples_split=min_samples_split,
            ccp_alpha=ccp_alpha,
            random_state=random_state,
            class_weight="balanced",
        )
        pipeline = Pipeline([("prep", preprocessor), ("clf", clf)])

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=y if y.nunique() > 1 else None
        )
        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)

        classes = sorted(y.unique().tolist())
        acc = float(accuracy_score(y_test, y_pred))
        prec = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
        rec = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
        f1 = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))
        report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
        cm = confusion_matrix(y_test, y_pred, labels=classes)
        cm_payload = {
            "labels": classes,
            "matrix": cm.tolist(),
        }

        cv_scores = cross_val_score(pipeline, X, y, cv=cv_folds, scoring="f1_weighted")
        cv_payload = {
            "folds": cv_folds,
            "f1Scores": [round(float(s), 4) for s in cv_scores],
            "f1Mean": round(float(cv_scores.mean()), 4),
            "f1Std": round(float(cv_scores.std()), 4),
        }

        tree_clf: DecisionTreeClassifier = pipeline.named_steps["clf"]
        prep = pipeline.named_steps["prep"]
        try:
            feature_names_out = list(prep.get_feature_names_out())
        except Exception:
            feature_names_out = feature_cols

        tree_text = export_text(tree_clf, feature_names=feature_names_out, max_depth=12)
        tree_json = export_tree_json(tree_clf, feature_names_out, classes)

        model_id = str(uuid.uuid4())
        model_dir = self._models_dir / model_id
        model_dir.mkdir(parents=True, exist_ok=True)

        metrics = {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "f1_weighted": round(f1, 4),
            "report": report,
            "confusionMatrix": cm_payload,
            "crossValidation": cv_payload,
            "trainSize": int(len(X_train)),
            "testSize": int(len(X_test)),
            "totalRows": int(len(df)),
        }

        payload = {
            "pipeline": pipeline,
            "feature_columns": feature_cols,
            "target_column": target_col,
            "class_labels": classes,
            "metrics": metrics,
            "tree_text": tree_text,
            "tree_json": tree_json,
            "config": config,
        }
        joblib.dump(payload, model_dir / "model.joblib")

        meta = {
            "id": model_id,
            "datasetId": dataset_id,
            "name": str(config.get("modelName") or f"J48-{datetime.now().strftime('%Y%m%d-%H%M')}"),
            "version": str(config.get("version") or "1.0.0"),
            "engine": "scikit-learn DecisionTreeClassifier (entropy)",
            "featureColumns": feature_cols,
            "targetColumn": target_col,
            "hyperparameters": {
                "maxDepth": max_depth,
                "minSamplesLeaf": min_samples_leaf,
                "minSamplesSplit": min_samples_split,
                "ccpAlpha": ccp_alpha,
                "testSize": test_size,
                "cvFolds": cv_folds,
                "randomState": random_state,
            },
            "metrics": metrics,
            "treeText": tree_text,
            "trainedAt": self._now(),
            "isActive": False,
        }
        (model_dir / "meta.json").write_text(json.dumps(meta, indent=2, default=str), encoding="utf-8")
        (model_dir / "tree.json").write_text(json.dumps(tree_json, indent=2, default=str), encoding="utf-8")

        if config.get("setActive", True):
            self.set_active_model(model_id)

        model_service_sync = self._sync_production_model(model_id, payload)
        meta["productionSynced"] = model_service_sync

        return meta

    def _sync_production_model(self, model_id: str, payload: dict[str, Any]) -> bool:
        try:
            prod_path = Path(settings.model_path)
            prod_path.parent.mkdir(parents=True, exist_ok=True)
            joblib.dump(
                {
                    "pipeline": payload["pipeline"],
                    "class_labels": payload["class_labels"],
                    "metrics": payload["metrics"],
                    "tree_text": payload["tree_text"],
                    "feature_order": payload["feature_columns"],
                    "lab_model_id": model_id,
                },
                prod_path,
            )
            from app.ml.model_service import model_service

            model_service._pipeline = payload["pipeline"]
            model_service._class_labels = list(payload["class_labels"])
            model_service._metrics = dict(payload["metrics"])
            model_service._tree_text = str(payload["tree_text"])
            return True
        except Exception as exc:
            logger.warning("No se pudo sincronizar modelo productivo: %s", exc)
            return False

    def list_models(self) -> list[dict[str, Any]]:
        models: list[dict[str, Any]] = []
        for meta_path in sorted(self._models_dir.glob("*/meta.json")):
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                meta["isActive"] = meta.get("id") == self._active_model_id
                models.append(meta)
            except Exception:
                continue
        return sorted(models, key=lambda m: m.get("trainedAt", ""), reverse=True)

    def get_model(self, model_id: str) -> dict[str, Any]:
        meta_path = self._models_dir / model_id / "meta.json"
        if not meta_path.exists():
            raise FileNotFoundError(f"Modelo no encontrado: {model_id}")
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        meta["isActive"] = model_id == self._active_model_id
        return meta

    def _load_model_payload(self, model_id: str) -> dict[str, Any]:
        path = self._models_dir / model_id / "model.joblib"
        if not path.exists():
            raise FileNotFoundError(f"Artefacto de modelo no encontrado: {model_id}")
        return joblib.load(path)

    def get_model_tree(self, model_id: str | None = None) -> dict[str, Any]:
        mid = model_id or self._active_model_id
        if not mid:
            raise ValueError("No hay modelo activo")
        tree_path = self._models_dir / mid / "tree.json"
        meta = self.get_model(mid)
        if tree_path.exists():
            tree_json = json.loads(tree_path.read_text(encoding="utf-8"))
        else:
            payload = self._load_model_payload(mid)
            tree_json = payload.get("tree_json", {})
        payload = self._load_model_payload(mid)
        class_labels = payload.get("class_labels") or []
        return {
            "modelId": mid,
            "treeText": meta.get("treeText", ""),
            "treeJson": tree_json,
            "metrics": meta.get("metrics", {}),
            "classLabels": class_labels,
        }

    def set_active_model(self, model_id: str) -> dict[str, Any]:
        meta = self.get_model(model_id)
        payload = self._load_model_payload(model_id)
        self._sync_production_model(model_id, payload)
        self._active_model_id = model_id
        active_file = self._lab_root / "active_model.txt"
        active_file.write_text(model_id, encoding="utf-8")
        for m in self.list_models():
            m_path = self._models_dir / m["id"] / "meta.json"
            if m_path.exists():
                data = json.loads(m_path.read_text(encoding="utf-8"))
                data["isActive"] = m["id"] == model_id
                m_path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
        meta["isActive"] = True
        return meta

    def compare_models(self, model_ids: list[str]) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for mid in model_ids:
            try:
                meta = self.get_model(mid)
                m = meta.get("metrics", {})
                rows.append(
                    {
                        "id": mid,
                        "name": meta.get("name"),
                        "version": meta.get("version"),
                        "trainedAt": meta.get("trainedAt"),
                        "accuracy": m.get("accuracy"),
                        "precision": m.get("precision"),
                        "recall": m.get("recall"),
                        "f1": m.get("f1"),
                        "maxDepth": meta.get("hyperparameters", {}).get("maxDepth"),
                        "cvF1Mean": m.get("crossValidation", {}).get("f1Mean"),
                        "isActive": meta.get("isActive", False),
                    }
                )
            except FileNotFoundError:
                continue
        return rows

    def predict_clinical(self, features: dict[str, Any], model_id: str | None = None) -> dict[str, Any]:
        mid = model_id or self._active_model_id
        if not mid:
            raise ValueError("Entrene o active un modelo antes de predecir")
        payload = self._load_model_payload(mid)
        pipeline: Pipeline = payload["pipeline"]
        feature_cols: list[str] = payload["feature_columns"]
        class_labels: list[str] = payload["class_labels"]

        row: dict[str, Any] = {}
        for col in feature_cols:
            val = features.get(col)
            if val is None and col in CLINICAL_FEATURE_HINTS:
                val = features.get(self._alias_key(col))
            if col in ("anxiety", "depression", "days_since_last", "stress", "adherence"):
                try:
                    row[col] = float(val) if val is not None else np.nan
                except (TypeError, ValueError):
                    row[col] = np.nan
            else:
                row[col] = str(val) if val is not None else "UNKNOWN"

        X = pd.DataFrame([row])
        clf: DecisionTreeClassifier = pipeline.named_steps["clf"]
        proba = pipeline.predict_proba(X)[0]
        classes = list(clf.classes_)
        idx = int(np.argmax(proba))
        label = str(classes[idx])
        probabilities = {str(classes[i]): round(float(proba[i]), 4) for i in range(len(classes))}
        risk_score = round(
            sum(
                {"LOW": 0.2, "MEDIUM": 0.55, "HIGH": 0.9}.get(k, 0.5) * v
                for k, v in probabilities.items()
            ),
            4,
        )

        relapse_prob = probabilities.get("HIGH", probabilities.get("MEDIUM", 0.0))
        recommendations = self._clinical_recommendations(label, features)

        return {
            "modelId": mid,
            "classLabel": label,
            "probabilities": probabilities,
            "relapseProbability": relapse_prob,
            "riskLevel": label,
            "riskScore": risk_score,
            "psychologicalScore": round(1.0 - risk_score, 4),
            "alertLevel": "CRITICAL" if label == "HIGH" or risk_score >= 0.75 else "WARNING" if label == "MEDIUM" else "NORMAL",
            "recommendations": recommendations,
            "featuresUsed": row,
        }

    def _alias_key(self, col: str) -> str:
        aliases = {
            "adherence": "adherencia_terapeutica",
            "attendance": "asistencia",
            "days_since_last": "dias_sin_sesion",
        }
        return aliases.get(col, col)

    def _clinical_recommendations(self, label: str, features: dict[str, Any]) -> list[str]:
        recs: list[str] = []
        if label in ("MEDIUM", "HIGH"):
            recs.append("Programar evaluación clínica prioritaria en los próximos 7 días.")
        if str(features.get("attendance") or features.get("asistencia")) == "IRREGULAR":
            recs.append("Implementar plan de adherencia con recordatorios y seguimiento semanal.")
        anxiety = float(features.get("anxiety") or features.get("ansiedad") or 0)
        depression = float(features.get("depression") or features.get("depresion") or 0)
        stress = float(features.get("stress") or features.get("estres") or 0)
        if anxiety >= 0.6:
            recs.append("Aplicar intervenciones de regulación de ansiedad (respiración, mindfulness).")
        if depression >= 0.6:
            recs.append("Valorar escalas PHQ-9 y posible derivación psiquiátrica.")
        if stress >= 0.6:
            recs.append("Incorporar técnicas de manejo de estrés y psicoeducación.")
        if not recs:
            recs.append("Continuar plan terapéutico; control rutinario en 30 días.")
        return recs

    def dashboard_stats(self) -> dict[str, Any]:
        models = self.list_models()
        datasets = self.list_datasets()
        active = self.get_model(self._active_model_id) if self._active_model_id else None
        risk_dist: dict[str, int] = {}
        if active:
            cm = active.get("metrics", {}).get("confusionMatrix", {})
            labels = cm.get("labels", [])
            matrix = cm.get("matrix", [])
            if labels and matrix:
                for i, lab in enumerate(labels):
                    risk_dist[str(lab)] = int(sum(matrix[i]))
        return {
            "datasetsCount": len(datasets),
            "modelsCount": len(models),
            "activeModel": active,
            "recentModels": models[:5],
            "classDistribution": risk_dist,
            "clinicalFeatures": CLINICAL_FEATURE_HINTS,
        }

    def delete_dataset(self, dataset_id: str) -> None:
        folder = self._datasets_dir / dataset_id
        if folder.exists():
            shutil.rmtree(folder)

    def delete_model(self, model_id: str) -> None:
        if self._active_model_id == model_id:
            raise ValueError("No puede eliminar el modelo activo")
        folder = self._models_dir / model_id
        if folder.exists():
            shutil.rmtree(folder)

    def init(self) -> None:
        active_file = self._lab_root / "active_model.txt"
        if active_file.exists():
            self._active_model_id = active_file.read_text(encoding="utf-8").strip() or None


lab_service = WekaLabService()

from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.tree import DecisionTreeClassifier


def _feature_name(feature_names: list[str], index: int) -> str:
    if 0 <= index < len(feature_names):
        return feature_names[index]
    return f"feature_{index}"


def export_tree_json(
    clf: DecisionTreeClassifier,
    feature_names: list[str],
    class_names: list[str],
) -> dict[str, Any]:
    tree = clf.tree_
    values = tree.value

    def node(i: int) -> dict[str, Any]:
        if tree.feature[i] < 0:
            counts = values[i][0]
            total = float(counts.sum())
            probs = (counts / total).tolist() if total > 0 else [0.0] * len(counts)
            pred_idx = int(np.argmax(counts))
            return {
                "type": "leaf",
                "id": f"n{i}",
                "samples": int(total),
                "classLabel": str(class_names[pred_idx]) if pred_idx < len(class_names) else str(pred_idx),
                "probabilities": {
                    str(class_names[j]): round(float(probs[j]), 4) for j in range(len(class_names))
                },
                "distribution": {str(class_names[j]): int(counts[j]) for j in range(len(class_names))},
            }

        left = node(tree.children_left[i])
        right = node(tree.children_right[i])
        threshold = float(tree.threshold[i])
        feat = _feature_name(feature_names, int(tree.feature[i]))
        return {
            "type": "split",
            "id": f"n{i}",
            "feature": feat,
            "threshold": round(threshold, 6),
            "samples": int(values[i][0].sum()),
            "left": left,
            "right": right,
            "rule": f"{feat} <= {threshold:.4f}",
        }

    return {
        "root": node(0),
        "featureNames": feature_names,
        "classLabels": [str(c) for c in class_names],
        "maxDepth": int(clf.get_depth()),
        "nLeaves": int(clf.get_n_leaves()),
    }

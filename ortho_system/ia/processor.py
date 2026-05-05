import cv2
import numpy as np
from typing import Any, Dict, List, Tuple


class AdvancedToothProcessor:
    """
    Segmentación heurística de dientes en fotografías intraorales y proyección a primitivas 3D.
    Pensado como fallback local cuando no hay API externa ni modelo de segmentación entrenado.
    """

    def __init__(self) -> None:
        self.pixel_to_mm = 0.12
        self.max_image_side = 1024
        self.min_area_ratio = 0.0006
        self.max_area_ratio = 0.14

    def reconstruct_3d_from_image(self, image_data: bytes) -> List[Dict[str, Any]]:
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return []

        img, _scale = self._resize_long_edge(img, self.max_image_side)
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        bgr_roi, gray_roi, off_x, off_y = self._central_roi(img, gray, margin_ratio=0.06)

        mask = self._build_teeth_mask(bgr_roi, gray_roi)
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        roi_area = bgr_roi.shape[0] * bgr_roi.shape[1]
        blobs: List[Dict[str, Any]] = []
        border_x = w * 0.02
        border_y = h * 0.02

        for cnt in contours:
            if not self._is_valid_tooth_contour(cnt, roi_area):
                continue
            x, y, bw, bh = cv2.boundingRect(cnt)
            cx = off_x + x + bw // 2
            cy = off_y + y + bh // 2
            if cx < border_x or cx > w - border_x or cy < border_y or cy > h - border_y:
                continue
            area = float(cv2.contourArea(cnt))
            hull = cv2.convexHull(cnt)
            ha = float(cv2.contourArea(hull)) or 1.0
            solidity = area / ha
            blobs.append({
                "cx": cx,
                "cy": cy,
                "w": bw,
                "h": bh,
                "solidity": solidity,
                "area": area,
            })

        blobs = self._nms_boxes(blobs, iou_threshold=0.38)
        mid_x = w / 2.0
        mid_y = h / 2.0
        fdi_by_index = self._assign_fdi_labels(blobs, w, h)

        reconstruction: List[Dict[str, Any]] = []
        for i, b in enumerate(blobs):
            cx, cy = b["cx"], b["cy"]
            fdi = fdi_by_index.get(i) or self._single_tooth_fdi(cx, cy, w, h)
            norm_x = (cx - mid_x) / (mid_x or 1.0)
            norm_y = (cy - mid_y) / (mid_y or 1.0)
            z_depth = (norm_x ** 2) * 26.0 + abs(norm_y) * 5.0
            conf = float(
                min(1.0, 0.3 + 0.5 * b["solidity"] + 0.2 * min(1.0, b["area"] / (roi_area * 0.018)))
            )

            reconstruction.append({
                "id": f"tooth_{fdi}_{i}",
                "fdi": fdi,
                "confidence": round(conf, 3),
                "pos_3d": {
                    "x": (cx - mid_x) * self.pixel_to_mm,
                    "y": (mid_y - cy) * self.pixel_to_mm,
                    "z": float(z_depth),
                },
                "dimensions": {
                    "w": float(b["w"] * self.pixel_to_mm),
                    "h": float(b["h"] * self.pixel_to_mm),
                    "d": float(b["w"] * self.pixel_to_mm * 0.82),
                },
                "rotation": {
                    "x": 0.08,
                    "y": float(-norm_x * 0.82),
                    "z": 0.0,
                },
            })

        reconstruction.sort(key=lambda x: x["fdi"])
        for k, item in enumerate(reconstruction):
            item["id"] = f"tooth_{item['fdi']}_{k}"
        return reconstruction

    def _resize_long_edge(self, img: np.ndarray, max_side: int) -> Tuple[np.ndarray, float]:
        hi, wi = img.shape[:2]
        long_edge = max(hi, wi)
        if long_edge <= max_side:
            return img, 1.0
        scale = max_side / float(long_edge)
        out = cv2.resize(img, (int(wi * scale), int(hi * scale)), interpolation=cv2.INTER_AREA)
        return out, scale

    def _central_roi(
        self, bgr: np.ndarray, gray: np.ndarray, margin_ratio: float
    ) -> Tuple[np.ndarray, np.ndarray, int, int]:
        h, w = gray.shape
        mx = int(w * margin_ratio)
        my = int(h * margin_ratio)
        x1, y1 = mx, my
        x2, y2 = w - mx, h - my
        if x2 <= x1 + 32 or y2 <= y1 + 32:
            return bgr, gray, 0, 0
        return bgr[y1:y2, x1:x2], gray[y1:y2, x1:x2], x1, y1

    def _clean_mask(self, binary: np.ndarray) -> np.ndarray:
        k_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (4, 4))
        k_big = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
        m = cv2.morphologyEx(binary, cv2.MORPH_OPEN, k_small, iterations=1)
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k_big, iterations=2)
        return m

    def _otsu_variants(self, plane: np.ndarray) -> List[np.ndarray]:
        blur = cv2.GaussianBlur(plane, (5, 5), 0)
        _, o = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        bright_teeth = np.mean(plane[o > 0]) > np.mean(plane[o == 0])
        hi = o if bright_teeth else cv2.bitwise_not(o)
        lo = cv2.bitwise_not(hi)
        return [hi, lo]

    def _build_teeth_mask(self, bgr: np.ndarray, gray: np.ndarray) -> np.ndarray:
        lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
        L = lab[:, :, 0]
        clahe = cv2.createCLAHE(clipLimit=2.8, tileGridSize=(8, 8))
        L_e = clahe.apply(L)
        den = cv2.bilateralFilter(L_e, 9, 72, 72)

        h, w = gray.shape
        roi_area = h * w
        best_mask: np.ndarray | None = None
        best_score = -1.0

        for plane in (den, gray):
            for cand in self._otsu_variants(plane):
                m = self._clean_mask(cand)
                cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                good = sum(1 for c in cnts if self._is_valid_tooth_contour(c, roi_area))
                score = self._mask_quality_score(good)
                if score > best_score:
                    best_score = score
                    best_mask = m

        if best_mask is None:
            best_mask = np.zeros_like(gray)

        if best_score < 2.0:
            ad = cv2.adaptiveThreshold(
                den, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 33, -4
            )
            m2 = self._clean_mask(ad)
            cnts2, _ = cv2.findContours(m2, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            good2 = sum(1 for c in cnts2 if self._is_valid_tooth_contour(c, roi_area))
            if self._mask_quality_score(good2) >= best_score:
                best_mask = m2

        hi_v = self._highlight_teeth_v_channel(bgr)
        _, pct = cv2.threshold(hi_v, int(np.percentile(hi_v, 58)), 255, cv2.THRESH_BINARY)
        m3 = self._clean_mask(pct)
        cnts3, _ = cv2.findContours(m3, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        good3 = sum(1 for c in cnts3 if self._is_valid_tooth_contour(c, roi_area))
        if self._mask_quality_score(good3) > best_score + 0.5:
            best_mask = m3

        return best_mask

    def _highlight_teeth_v_channel(self, bgr: np.ndarray) -> np.ndarray:
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        v = hsv[:, :, 2].astype(np.float32)
        s = hsv[:, :, 1].astype(np.float32) / 255.0
        boosted = v * (0.55 + 0.45 * (1.0 - s))
        boosted = np.clip(boosted, 0, 255).astype(np.uint8)
        return boosted

    def _mask_quality_score(self, good_count: int) -> float:
        if good_count < 4:
            return good_count * 0.35
        if good_count <= 28:
            return 4.0 + min(good_count, 20) * 0.15
        return max(0.0, 7.0 - (good_count - 28) * 0.12)

    def _is_valid_tooth_contour(self, cnt: np.ndarray, img_area: float) -> bool:
        area = cv2.contourArea(cnt)
        if area < img_area * self.min_area_ratio or area > img_area * self.max_area_ratio:
            return False
        x, y, bw, bh = cv2.boundingRect(cnt)
        if bw < 6 or bh < 6:
            return False
        ar = bw / float(bh)
        if ar < 0.22 or ar > 4.2:
            return False
        hull = cv2.convexHull(cnt)
        ha = cv2.contourArea(hull)
        if ha < 1.0:
            return False
        solidity = area / ha
        if solidity < 0.42:
            return False
        extent = area / float(bw * bh)
        if extent < 0.18:
            return False
        return True

    def _bbox_iou(self, a: Tuple[int, int, int, int], b: Tuple[int, int, int, int]) -> float:
        ax, ay, aw, ah = a
        bx, by, bw, bh = b
        x1 = max(ax, bx)
        y1 = max(ay, by)
        x2 = min(ax + aw, bx + bw)
        y2 = min(ay + ah, by + bh)
        inter = max(0, x2 - x1) * max(0, y2 - y1)
        if inter <= 0:
            return 0.0
        ua = aw * ah + bw * bh - inter
        return inter / float(ua or 1.0)

    def _nms_boxes(self, blobs: List[Dict[str, Any]], iou_threshold: float) -> List[Dict[str, Any]]:
        if not blobs:
            return []
        scored = sorted(blobs, key=lambda b: b["solidity"] * np.sqrt(b["area"]), reverse=True)
        boxes = [(int(b["cx"] - b["w"] // 2), int(b["cy"] - b["h"] // 2), int(b["w"]), int(b["h"])) for b in scored]
        keep: List[int] = []
        for i, bi in enumerate(boxes):
            ok = True
            for j in keep:
                if self._bbox_iou(bi, boxes[j]) > iou_threshold:
                    ok = False
                    break
            if ok:
                keep.append(i)
        return [scored[i] for i in keep]

    def _assign_fdi_labels(self, blobs: List[Dict[str, Any]], w: int, h: int) -> Dict[int, str]:
        mid_x = w / 2.0
        mid_y = h / 2.0
        q1: List[Tuple[int, float]] = []
        q2: List[Tuple[int, float]] = []
        q3: List[Tuple[int, float]] = []
        q4: List[Tuple[int, float]] = []
        for idx, b in enumerate(blobs):
            cx, cy = b["cx"], b["cy"]
            if cy < mid_y and cx < mid_x:
                q1.append((idx, cx))
            elif cy < mid_y and cx >= mid_x:
                q2.append((idx, cx))
            elif cy >= mid_y and cx >= mid_x:
                q3.append((idx, cx))
            else:
                q4.append((idx, cx))

        out: Dict[int, str] = {}
        # Q1: superior derecha del paciente (mitad izquierda de la imagen). 11 = mesial a la línea media.
        q1_sorted = sorted(q1, key=lambda t: -t[1])
        for slot, (idx, _) in enumerate(q1_sorted):
            out[idx] = f"1{min(slot + 1, 8)}"
        q2_sorted = sorted(q2, key=lambda t: t[1])
        for slot, (idx, _) in enumerate(q2_sorted):
            out[idx] = f"2{min(slot + 1, 8)}"
        q3_sorted = sorted(q3, key=lambda t: t[1])
        for slot, (idx, _) in enumerate(q3_sorted):
            out[idx] = f"3{min(slot + 1, 8)}"
        q4_sorted = sorted(q4, key=lambda t: -t[1])
        for slot, (idx, _) in enumerate(q4_sorted):
            out[idx] = f"4{min(slot + 1, 8)}"
        return out

    def _single_tooth_fdi(self, cx: float, cy: float, w: int, h: int) -> str:
        mid_x = w / 2.0
        mid_y = h / 2.0
        is_upper = cy < mid_y
        is_right_patient = cx < mid_x
        if is_upper and is_right_patient:
            return "11"
        if is_upper:
            return "21"
        if is_right_patient:
            return "41"
        return "31"

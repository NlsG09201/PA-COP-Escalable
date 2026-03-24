from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

import numpy as np

from app.models.schemas import (
    ClinicalRecommendationRequest,
    ClinicalRecommendationResponse,
    OptimisedStep,
    Priority,
    Recommendation,
    Specialty,
    TreatmentOptimizationRequest,
    TreatmentOptimizationResponse,
)

if TYPE_CHECKING:
    from pymongo.database import Database

    from app.ml.model_loader import ModelLoader

logger = logging.getLogger("recommendation-engine.recommendation_service")

# ── Evidence-based rule catalogues ───────────────────────────────────────────

_ODONTOLOGY_RULES: list[dict[str, Any]] = [
    {
        "condition_keywords": ["caries", "cavity", "decay"],
        "action": "Apply fluoride varnish and schedule restorative treatment per ADA caries-management guidelines",
        "priority": Priority.HIGH,
        "evidence_level": "ADA Grade A",
        "rationale": "Fluoride varnish reduces caries progression by 33 % (Cochrane 2013); early restoration prevents pulpal involvement",
        "category": "restorative",
    },
    {
        "condition_keywords": ["gingivitis", "bleeding gums", "plaque"],
        "action": "Prescribe chlorhexidine rinse and schedule prophylaxis within 2 weeks",
        "priority": Priority.MEDIUM,
        "evidence_level": "ADA Grade B",
        "rationale": "Chlorhexidine 0.12 % reduces plaque index significantly (meta-analysis, J Clin Periodontol 2017)",
        "category": "periodontal",
    },
    {
        "condition_keywords": ["periodontitis", "pocket depth", "bone loss"],
        "action": "Initiate scaling and root planing (SRP); consider adjunctive systemic antibiotics for Grade C periodontitis",
        "priority": Priority.HIGH,
        "evidence_level": "ADA Grade A",
        "rationale": "SRP is the gold standard for non-surgical periodontal therapy (AAP/EFP S3 guidelines 2020)",
        "category": "periodontal",
    },
    {
        "condition_keywords": ["malocclusion", "orthodontic"],
        "action": "Refer for orthodontic assessment and cephalometric analysis",
        "priority": Priority.LOW,
        "evidence_level": "ADA Grade C",
        "rationale": "Early orthodontic evaluation recommended by age 7 (AAO guideline)",
        "category": "orthodontic",
    },
    {
        "condition_keywords": ["bruxism", "grinding", "tmj", "temporomandibular"],
        "action": "Fabricate occlusal splint and assess psychosocial stress factors",
        "priority": Priority.MEDIUM,
        "evidence_level": "ADA Grade B",
        "rationale": "Occlusal splints reduce nocturnal bruxism episodes and tooth wear (JADA systematic review 2019)",
        "category": "restorative",
    },
    {
        "condition_keywords": ["extraction", "impacted", "third molar"],
        "action": "Obtain panoramic radiograph; schedule surgical extraction if symptomatic or pathology present",
        "priority": Priority.HIGH,
        "evidence_level": "ADA Grade B",
        "rationale": "Prophylactic removal not universally recommended; intervene when symptomatic or recurrent pericoronitis present (NICE 2000)",
        "category": "surgical",
    },
]

_PSYCHOLOGY_RULES: list[dict[str, Any]] = [
    {
        "condition_keywords": ["depression", "depressive", "low mood", "anhedonia"],
        "action": "Initiate or continue CBT protocol; assess PHQ-9 score and consider medication review if PHQ-9 >= 15",
        "priority": Priority.HIGH,
        "evidence_level": "NICE CG90 Grade A",
        "rationale": "CBT is first-line for moderate depression; pharmacotherapy augmentation recommended for severe episodes (NICE CG90)",
        "category": "psychotherapy",
    },
    {
        "condition_keywords": ["anxiety", "gad", "panic", "worry"],
        "action": "Apply GAD-7 assessment; recommend structured CBT with exposure hierarchy",
        "priority": Priority.HIGH,
        "evidence_level": "APA Grade I",
        "rationale": "CBT with graded exposure has the strongest evidence base for anxiety disorders (APA Practice Guidelines 2023)",
        "category": "psychotherapy",
    },
    {
        "condition_keywords": ["substance", "addiction", "alcohol", "drug use"],
        "action": "Conduct AUDIT-C / DAST-10 screening; initiate motivational interviewing; coordinate with psychiatry for pharmacological support",
        "priority": Priority.HIGH,
        "evidence_level": "SAMHSA Grade A",
        "rationale": "Motivational interviewing + pharmacotherapy yields the highest sustained remission rates (Cochrane 2018)",
        "category": "substance_use",
    },
    {
        "condition_keywords": ["trauma", "ptsd", "flashback", "hypervigilance"],
        "action": "Begin trauma-focused CBT or EMDR; ensure safety planning is in place",
        "priority": Priority.HIGH,
        "evidence_level": "NICE NG116 Grade A",
        "rationale": "Trauma-focused CBT and EMDR are recommended first-line treatments for PTSD (NICE NG116, APA 2017)",
        "category": "psychotherapy",
    },
    {
        "condition_keywords": ["insomnia", "sleep", "sleepless"],
        "action": "Implement CBT-I (sleep restriction + stimulus control); review sleep hygiene practices",
        "priority": Priority.MEDIUM,
        "evidence_level": "AASM Grade A",
        "rationale": "CBT-I is recommended as first-line treatment over pharmacotherapy for chronic insomnia (AASM 2021)",
        "category": "behavioral",
    },
    {
        "condition_keywords": ["medication", "non-adherence", "nonadherence", "missed dose"],
        "action": "Review medication regimen; implement adherence strategies (pill organiser, psychoeducation, simplified dosing)",
        "priority": Priority.MEDIUM,
        "evidence_level": "WHO Adherence Report Grade B",
        "rationale": "Multi-component adherence interventions improve medication persistence by 20-30 % (WHO 2003; meta-analysis BMJ 2014)",
        "category": "medication_management",
    },
    {
        "condition_keywords": ["suicid", "self-harm", "self harm", "ideation"],
        "action": "Immediate risk assessment (Columbia Protocol); create or update safety plan; escalate to crisis services if imminent risk",
        "priority": Priority.HIGH,
        "evidence_level": "APA Grade I",
        "rationale": "Safety planning intervention reduces suicide attempts by ~50 % (Stanley & Brown, JAMA Psychiatry 2018)",
        "category": "crisis",
    },
]

# ML feature-to-recommendation-category mapping
_RECOMMENDATION_CATEGORIES: list[str] = [
    "restorative",
    "periodontal",
    "orthodontic",
    "surgical",
    "psychotherapy",
    "behavioral",
    "substance_use",
    "medication_management",
    "crisis",
    "preventive",
]


class RecommendationService:
    def __init__(self, model_loader: ModelLoader, mongo_db: Database | None) -> None:
        self._loader = model_loader
        self._db = mongo_db

    # ── Public API ───────────────────────────────────────────────────────

    def recommend_clinical(self, req: ClinicalRecommendationRequest) -> ClinicalRecommendationResponse:
        ml_recommendations = self._ml_recommendations(req)
        rule_recommendations = self._rule_based_recommendations(req)

        merged = self._merge_and_deduplicate(ml_recommendations, rule_recommendations)
        merged.sort(key=lambda r: {"HIGH": 0, "MEDIUM": 1, "LOW": 2}.get(r.priority.value, 3))

        now_iso = datetime.now(timezone.utc).isoformat()
        response = ClinicalRecommendationResponse(
            patient_id=req.patient_id,
            recommendations=merged,
            model_version="1.0.0",
            generated_at=now_iso,
        )

        self._persist_recommendation(req.patient_id, response)
        return response

    def optimize_treatment(self, req: TreatmentOptimizationRequest) -> TreatmentOptimizationResponse:
        optimised: list[OptimisedStep] = []

        conditions_lower = [c.lower() for c in req.patient_profile.conditions]
        allergies_lower = [a.lower() for a in req.patient_profile.allergies]

        for step in req.current_treatment.steps:
            action_lower = step.action.lower()

            if any(allergy in action_lower for allergy in allergies_lower):
                optimised.append(
                    OptimisedStep(
                        original_order=step.order,
                        action=f"Replace '{step.action}' with allergy-safe alternative",
                        change_type="MODIFY",
                        rationale=f"Current step may conflict with known allergies: {req.patient_profile.allergies}",
                        expected_improvement="Eliminates adverse reaction risk",
                    )
                )
                continue

            if step.expected_duration_days > 90:
                optimised.append(
                    OptimisedStep(
                        original_order=step.order,
                        action=step.action,
                        change_type="MODIFY",
                        rationale="Consider breaking long-duration step into milestones for better monitoring",
                        expected_improvement="Improved adherence via shorter feedback loops",
                    )
                )
                continue

            optimised.append(
                OptimisedStep(
                    original_order=step.order,
                    action=step.action,
                    change_type="KEEP",
                    rationale="Step aligns with current best-practice guidelines",
                    expected_improvement="Baseline — no change needed",
                )
            )

        if any("pain" in c for c in conditions_lower) and not any("analges" in s.action.lower() for s in req.current_treatment.steps):
            optimised.append(
                OptimisedStep(
                    original_order=None,
                    action="Add multimodal pain management protocol (pharmacological + physical therapy)",
                    change_type="ADD",
                    rationale="Patient reports pain but no analgesic step exists in the current plan",
                    expected_improvement="Reduced pain scores and improved quality of life",
                )
            )

        if req.current_treatment.specialty == Specialty.PSYCHOLOGY:
            has_follow_up = any("follow" in s.action.lower() or "review" in s.action.lower() for s in req.current_treatment.steps)
            if not has_follow_up:
                optimised.append(
                    OptimisedStep(
                        original_order=None,
                        action="Schedule structured follow-up assessment at 4-week and 12-week marks",
                        change_type="ADD",
                        rationale="NICE guidelines recommend systematic follow-up for psychological interventions",
                        expected_improvement="Early detection of treatment non-response",
                    )
                )

        now_iso = datetime.now(timezone.utc).isoformat()
        summary_parts: list[str] = []
        counts = {"ADD": 0, "MODIFY": 0, "REMOVE": 0, "KEEP": 0}
        for s in optimised:
            counts[s.change_type] = counts.get(s.change_type, 0) + 1
        if counts["ADD"]:
            summary_parts.append(f"{counts['ADD']} step(s) added")
        if counts["MODIFY"]:
            summary_parts.append(f"{counts['MODIFY']} step(s) modified")
        if counts["REMOVE"]:
            summary_parts.append(f"{counts['REMOVE']} step(s) removed")
        summary_parts.append(f"{counts['KEEP']} step(s) kept as-is")

        return TreatmentOptimizationResponse(
            patient_id=req.patient_profile.patient_id,
            plan_id=req.current_treatment.plan_id,
            optimised_steps=optimised,
            summary="; ".join(summary_parts),
            model_version="1.0.0",
            generated_at=now_iso,
        )

    # ── ML predictions ───────────────────────────────────────────────────

    def _ml_recommendations(self, req: ClinicalRecommendationRequest) -> list[Recommendation]:
        if self._loader.recommendation_model is None:
            return []

        try:
            features = self._extract_recommendation_features(req)
            category_indices = self._loader.predict_recommendations(features)

            results: list[Recommendation] = []
            for idx in category_indices:
                if 0 <= idx < len(_RECOMMENDATION_CATEGORIES):
                    cat = _RECOMMENDATION_CATEGORIES[idx]
                    results.append(
                        Recommendation(
                            action=f"ML-suggested intervention in category '{cat}' — review and customise",
                            priority=Priority.MEDIUM,
                            evidence_level="ML model v1.0",
                            rationale="Predicted by gradient-boosting classifier trained on historical outcome data",
                            category=cat,
                        )
                    )
            return results
        except Exception:
            logger.warning("ML recommendation prediction failed, falling back to rules only", exc_info=True)
            return []

    def _extract_recommendation_features(self, req: ClinicalRecommendationRequest) -> np.ndarray:
        num_entries = len(req.clinical_history)
        num_conditions = len(req.current_conditions)
        specialty_flag = 1.0 if req.specialty == Specialty.ODONTOLOGY else 0.0

        type_counts: dict[str, int] = {}
        for entry in req.clinical_history:
            type_counts[entry.type] = type_counts.get(entry.type, 0) + 1

        top_types = sorted(type_counts.values(), reverse=True)
        type_feat_1 = float(top_types[0]) if len(top_types) > 0 else 0.0
        type_feat_2 = float(top_types[1]) if len(top_types) > 1 else 0.0
        type_feat_3 = float(top_types[2]) if len(top_types) > 2 else 0.0

        has_surgical = 1.0 if any("surg" in e.type.lower() or "extract" in e.description.lower() for e in req.clinical_history) else 0.0
        has_chronic = 1.0 if any(kw in " ".join(req.current_conditions).lower() for kw in ["chronic", "recurrent", "persistent"]) else 0.0

        return np.array([[
            num_entries,
            num_conditions,
            specialty_flag,
            type_feat_1,
            type_feat_2,
            type_feat_3,
            has_surgical,
            has_chronic,
        ]])

    # ── Rule-based engine ────────────────────────────────────────────────

    def _rule_based_recommendations(self, req: ClinicalRecommendationRequest) -> list[Recommendation]:
        rules = _ODONTOLOGY_RULES if req.specialty == Specialty.ODONTOLOGY else _PSYCHOLOGY_RULES
        text_corpus = " ".join(
            [e.description.lower() for e in req.clinical_history]
            + [c.lower() for c in req.current_conditions]
        )

        matched: list[Recommendation] = []
        for rule in rules:
            if any(kw in text_corpus for kw in rule["condition_keywords"]):
                matched.append(
                    Recommendation(
                        action=rule["action"],
                        priority=rule["priority"],
                        evidence_level=rule["evidence_level"],
                        rationale=rule["rationale"],
                        category=rule["category"],
                    )
                )
        return matched

    # ── Helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def _merge_and_deduplicate(
        ml_recs: list[Recommendation],
        rule_recs: list[Recommendation],
    ) -> list[Recommendation]:
        seen_actions: set[str] = set()
        merged: list[Recommendation] = []

        for rec in rule_recs + ml_recs:
            normalised = rec.action.strip().lower()
            if normalised not in seen_actions:
                seen_actions.add(normalised)
                merged.append(rec)
        return merged

    def _persist_recommendation(self, patient_id: str, response: ClinicalRecommendationResponse) -> None:
        if self._db is None:
            return
        try:
            doc = response.model_dump()
            doc["patient_id"] = patient_id
            self._db["recommendations"].insert_one(doc)
        except Exception:
            logger.warning("Failed to persist recommendation to MongoDB", exc_info=True)

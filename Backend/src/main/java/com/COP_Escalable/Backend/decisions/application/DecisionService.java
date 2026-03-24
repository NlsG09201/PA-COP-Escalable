package com.COP_Escalable.Backend.decisions.application;

import com.COP_Escalable.Backend.decisions.domain.ClinicalDecision;
import com.COP_Escalable.Backend.decisions.infrastructure.ClinicalDecisionRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class DecisionService {

	private static final Logger log = LoggerFactory.getLogger(DecisionService.class);

	private final ClinicalDecisionRepository decisionRepository;
	private final ObjectMapper objectMapper;
	private final RestClient restClient;

	public DecisionService(ClinicalDecisionRepository decisionRepository,
						   ObjectMapper objectMapper,
						   RestClient.Builder restClientBuilder) {
		this.decisionRepository = decisionRepository;
		this.objectMapper = objectMapper;
		this.restClient = restClientBuilder.baseUrl("http://localhost:8000").build();
	}

	@Transactional
	@SuppressWarnings("unchecked")
	public ClinicalDecision generateRecommendation(UUID patientId, String decisionType,
												   Map<String, Object> context) {
		var tenant = TenantContextHolder.require();
		var orgId = tenant.organizationId();
		var siteId = tenant.siteId();

		String inputJson;
		try {
			inputJson = objectMapper.writeValueAsString(Map.of(
					"patientId", patientId.toString(),
					"decisionType", decisionType,
					"context", context
			));
		} catch (Exception e) {
			inputJson = "{}";
		}

		Map<String, Object> recommendation;
		String modelVersion;

		try {
			var payload = Map.of(
					"patient_id", patientId.toString(),
					"decision_type", decisionType,
					"context", context
			);
			recommendation = restClient.post()
					.uri("/api/recommendations/clinical")
					.body(payload)
					.retrieve()
					.body(Map.class);
			modelVersion = recommendation != null
					? (String) recommendation.getOrDefault("model_version", "engine-v1") : "engine-v1";
		} catch (Exception e) {
			log.warn("Recommendation engine unavailable, using rule-based fallback: {}", e.getMessage());
			recommendation = ruleBasedRecommendation(decisionType, context);
			modelVersion = "rule-based-v1";
		}

		String outputJson;
		try {
			outputJson = objectMapper.writeValueAsString(recommendation);
		} catch (Exception e) {
			outputJson = "{}";
		}

		ClinicalDecision decision = ClinicalDecision.create(
				orgId, siteId, patientId, decisionType, inputJson, outputJson, modelVersion);
		return decisionRepository.save(decision);
	}

	@Transactional
	public ClinicalDecision acceptDecision(UUID decisionId, UUID userId) {
		var decision = decisionRepository.findById(decisionId)
				.orElseThrow(() -> new IllegalArgumentException("Decision not found"));
		decision.accept(userId);
		return decisionRepository.save(decision);
	}

	@Transactional(readOnly = true)
	public List<ClinicalDecision> getPatientDecisions(UUID patientId) {
		var tenant = TenantContextHolder.require();
		return decisionRepository.findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
				tenant.organizationId(), tenant.siteId(), patientId);
	}

	@Transactional(readOnly = true)
	public Map<String, Object> getSiteDecisionStats() {
		var tenant = TenantContextHolder.require();
		var orgId = tenant.organizationId();
		var siteId = tenant.siteId();

		var allDecisions = decisionRepository.findByOrganizationIdAndSiteIdOrderByCreatedAtDesc(orgId, siteId);
		long total = allDecisions.size();
		long accepted = decisionRepository.countByOrganizationIdAndSiteIdAndAccepted(orgId, siteId, true);

		Map<String, Long> typeDistribution = new LinkedHashMap<>();
		for (var decision : allDecisions) {
			typeDistribution.merge(decision.getDecisionType(), 1L, Long::sum);
		}

		double acceptanceRate = total > 0 ? (double) accepted / total * 100.0 : 0.0;

		Map<String, Object> stats = new LinkedHashMap<>();
		stats.put("totalDecisions", total);
		stats.put("acceptedDecisions", accepted);
		stats.put("acceptanceRate", Math.round(acceptanceRate * 100.0) / 100.0);
		stats.put("decisionTypeDistribution", typeDistribution);
		return stats;
	}

	private Map<String, Object> ruleBasedRecommendation(String decisionType, Map<String, Object> context) {
		return switch (decisionType) {
			case "TREATMENT_RECOMMENDATION" -> ruleBasedDentalRecommendation(context);
			case "MEDICATION_REVIEW" -> ruleBasedPsychRecommendation(context);
			case "REFERRAL" -> ruleBasedReferral(context);
			default -> Map.of(
					"recommendation", "General clinical review recommended",
					"confidence", 0.5,
					"rationale", "No specific rule-based logic for type: " + decisionType
			);
		};
	}

	private Map<String, Object> ruleBasedDentalRecommendation(Map<String, Object> context) {
		Map<String, Object> result = new LinkedHashMap<>();
		List<Map<String, String>> recommendations = new ArrayList<>();
		String conditions = String.valueOf(context.getOrDefault("conditions", "")).toLowerCase();

		if (conditions.contains("caries") || conditions.contains("cavit")) {
			recommendations.add(Map.of(
					"action", "Dental restoration",
					"priority", "HIGH",
					"rationale", "Active caries detected - restoration indicated to prevent progression"
			));
		}
		if (conditions.contains("missing") || conditions.contains("ausente")) {
			recommendations.add(Map.of(
					"action", "Evaluate implant or bridge",
					"priority", "MEDIUM",
					"rationale", "Missing teeth detected - prosthetic rehabilitation recommended"
			));
		}
		if (conditions.contains("periodontal") || conditions.contains("gingivit")) {
			recommendations.add(Map.of(
					"action", "Scaling and root planing",
					"priority", "HIGH",
					"rationale", "Periodontal disease indicated - prophylactic treatment needed"
			));
		}
		if (recommendations.isEmpty()) {
			recommendations.add(Map.of(
					"action", "Routine dental examination",
					"priority", "LOW",
					"rationale", "No urgent conditions detected - continue preventive care"
			));
		}

		result.put("recommendations", recommendations);
		result.put("confidence", 0.7);
		return result;
	}

	private Map<String, Object> ruleBasedPsychRecommendation(Map<String, Object> context) {
		Map<String, Object> result = new LinkedHashMap<>();
		List<Map<String, String>> recommendations = new ArrayList<>();
		String metrics = String.valueOf(context.getOrDefault("metrics", "")).toLowerCase();

		if (metrics.contains("anxiety") || metrics.contains("ansiedad")) {
			recommendations.add(Map.of(
					"action", "Cognitive Behavioral Therapy (CBT)",
					"priority", "HIGH",
					"rationale", "Elevated anxiety markers - CBT is first-line evidence-based intervention"
			));
		}
		if (metrics.contains("depression") || metrics.contains("depresion")) {
			recommendations.add(Map.of(
					"action", "Medication review with psychiatry",
					"priority", "HIGH",
					"rationale", "Depression indicators present - pharmacological evaluation recommended"
			));
		}
		if (metrics.contains("adherence") || metrics.contains("adherencia")) {
			recommendations.add(Map.of(
					"action", "Motivational interviewing",
					"priority", "MEDIUM",
					"rationale", "Low treatment adherence - motivational techniques may improve engagement"
			));
		}
		if (recommendations.isEmpty()) {
			recommendations.add(Map.of(
					"action", "Continue current therapeutic approach",
					"priority", "LOW",
					"rationale", "No specific risk indicators - maintain current treatment plan"
			));
		}

		result.put("recommendations", recommendations);
		result.put("confidence", 0.65);
		return result;
	}

	private Map<String, Object> ruleBasedReferral(Map<String, Object> context) {
		Map<String, Object> result = new LinkedHashMap<>();
		String specialty = String.valueOf(context.getOrDefault("specialty", "general"));
		result.put("recommendations", List.of(Map.of(
				"action", "Referral to " + specialty,
				"priority", "MEDIUM",
				"rationale", "Clinical indicators suggest specialist evaluation would be beneficial"
		)));
		result.put("confidence", 0.6);
		return result;
	}
}

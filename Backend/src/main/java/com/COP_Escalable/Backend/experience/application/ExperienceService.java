package com.COP_Escalable.Backend.experience.application;

import com.COP_Escalable.Backend.experience.domain.ChurnPrediction;
import com.COP_Escalable.Backend.experience.domain.SatisfactionSurvey;
import com.COP_Escalable.Backend.experience.infrastructure.ChurnPredictionRepository;
import com.COP_Escalable.Backend.experience.infrastructure.SatisfactionSurveyRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ExperienceService {

	private static final Logger log = LoggerFactory.getLogger(ExperienceService.class);

	private final SatisfactionSurveyRepository surveyRepository;
	private final ChurnPredictionRepository churnRepository;
	private final ExperienceProperties properties;
	private final ObjectMapper objectMapper;

	public ExperienceService(SatisfactionSurveyRepository surveyRepository,
							 ChurnPredictionRepository churnRepository,
							 ExperienceProperties properties,
							 ObjectMapper objectMapper) {
		this.surveyRepository = surveyRepository;
		this.churnRepository = churnRepository;
		this.properties = properties;
		this.objectMapper = objectMapper;
	}

	@Transactional
	public SatisfactionSurvey sendNpsSurvey(UUID patientId, String triggerEvent) {
		if (!properties.isNpsEnabled()) {
			throw new IllegalStateException("NPS surveys are disabled");
		}

		var tenant = TenantContextHolder.require();
		Instant cooldownCutoff = Instant.now().minus(properties.getSurveyCooldownDays(), ChronoUnit.DAYS);

		boolean recentSurveyExists = surveyRepository.existsByOrganizationIdAndSiteIdAndPatientIdAndCreatedAtAfter(
				tenant.organizationId(), tenant.siteId(), patientId, cooldownCutoff);

		if (recentSurveyExists) {
			throw new IllegalStateException(
					"Survey cooldown period not yet elapsed (" + properties.getSurveyCooldownDays() + " days)");
		}

		var survey = SatisfactionSurvey.create(
				tenant.organizationId(), tenant.siteId(), patientId, "NPS", triggerEvent);
		survey.markSent();
		return surveyRepository.save(survey);
	}

	@Transactional
	public SatisfactionSurvey completeNpsSurvey(UUID surveyId, int npsScore, String feedback) {
		if (npsScore < 0 || npsScore > 10) {
			throw new IllegalArgumentException("NPS score must be between 0 and 10");
		}

		var survey = surveyRepository.findById(surveyId)
				.orElseThrow(() -> new IllegalArgumentException("Survey not found"));

		if (!"SENT".equals(survey.getStatus()) && !"PENDING".equals(survey.getStatus())) {
			throw new IllegalStateException("Survey is not in a completable state");
		}

		BigDecimal satisfaction = BigDecimal.valueOf(npsScore)
				.divide(BigDecimal.TEN, 2, RoundingMode.HALF_UP);
		survey.complete(npsScore, satisfaction, feedback);
		return surveyRepository.save(survey);
	}

	@Transactional(readOnly = true)
	public Map<String, Object> calculateNpsScore(UUID siteId) {
		var tenant = TenantContextHolder.require();
		Instant since = Instant.now().minus(90, ChronoUnit.DAYS);

		List<SatisfactionSurvey> completed = surveyRepository
				.findByOrganizationIdAndSiteIdAndStatusAndCompletedAtAfter(
						tenant.organizationId(), siteId != null ? siteId : tenant.siteId(),
						"COMPLETED", since);

		if (completed.isEmpty()) {
			return Map.of("nps", 0, "totalResponses", 0, "message", "No completed surveys in the last 90 days");
		}

		long promoters = completed.stream().filter(s -> s.npsCategory().equals("PROMOTER")).count();
		long detractors = completed.stream().filter(s -> s.npsCategory().equals("DETRACTOR")).count();
		long total = completed.size();

		double nps = ((double) (promoters - detractors) / total) * 100;

		return Map.of(
				"nps", Math.round(nps),
				"promoters", promoters,
				"passives", total - promoters - detractors,
				"detractors", detractors,
				"totalResponses", total
		);
	}

	@Transactional
	public ChurnPrediction predictChurn(UUID patientId) {
		var tenant = TenantContextHolder.require();
		var orgId = tenant.organizationId();
		var siteId = tenant.siteId();

		Map<String, Object> factors = new LinkedHashMap<>();
		double score = 0.0;

		List<SatisfactionSurvey> surveys = surveyRepository
				.findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(orgId, siteId, patientId);

		boolean noRecentVisits = surveys.isEmpty() ||
				surveys.get(0).getCreatedAt().isBefore(Instant.now().minus(90, ChronoUnit.DAYS));
		if (noRecentVisits) {
			score += 0.3;
			factors.put("no_visits_90_days", true);
		}

		boolean decliningSatisfaction = false;
		List<SatisfactionSurvey> completedSurveys = surveys.stream()
				.filter(s -> "COMPLETED".equals(s.getStatus()) && s.getNpsScore() != null)
				.toList();
		if (completedSurveys.size() >= 2) {
			int latestScore = completedSurveys.get(0).getNpsScore();
			int previousScore = completedSurveys.get(1).getNpsScore();
			if (latestScore < previousScore) {
				decliningSatisfaction = true;
				score += 0.2;
				factors.put("declining_satisfaction", true);
			}
		}

		long missedSurveys = surveys.stream().filter(s -> "EXPIRED".equals(s.getStatus())).count();
		if (missedSurveys > 0) {
			score += 0.2;
			factors.put("missed_surveys", missedSurveys);
		}

		double lowAdherenceRisk = completedSurveys.isEmpty() ? 0.15 : 0.0;
		if (completedSurveys.size() == 1 && completedSurveys.get(0).getNpsScore() != null
				&& completedSurveys.get(0).getNpsScore() < 5) {
			lowAdherenceRisk = 0.15;
		}
		if (lowAdherenceRisk > 0) {
			score += lowAdherenceRisk;
			factors.put("low_therapy_adherence", true);
		}

		boolean hasComplaints = completedSurveys.stream()
				.anyMatch(s -> s.getFeedbackText() != null
						&& (s.getFeedbackText().toLowerCase().contains("complaint")
						|| s.getFeedbackText().toLowerCase().contains("queja")
						|| s.getNpsScore() != null && s.getNpsScore() <= 3));
		if (hasComplaints) {
			score += 0.15;
			factors.put("unresolved_complaints", true);
		}

		score = Math.min(1.0, score);
		String riskLevel = score < 0.3 ? "LOW" : score < 0.5 ? "MEDIUM" : score < 0.7 ? "HIGH" : "CRITICAL";

		List<String> actions = switch (riskLevel) {
			case "CRITICAL" -> List.of("Personal outreach required", "Offer retention incentive", "Schedule callback");
			case "HIGH" -> List.of("Send personalized re-engagement message", "Offer flexible scheduling");
			case "MEDIUM" -> List.of("Send satisfaction follow-up", "Review service quality");
			default -> List.of("Continue standard engagement");
		};

		String factorsJson;
		String actionsJson;
		try {
			factorsJson = objectMapper.writeValueAsString(factors);
			actionsJson = objectMapper.writeValueAsString(actions);
		} catch (Exception e) {
			factorsJson = "{}";
			actionsJson = "[]";
		}

		ChurnPrediction prediction = ChurnPrediction.create(
				orgId, siteId, patientId,
				BigDecimal.valueOf(score).setScale(4, RoundingMode.HALF_UP),
				riskLevel, factorsJson, actionsJson, "rule-based-v1"
		);
		return churnRepository.save(prediction);
	}

	@Transactional(readOnly = true)
	public Map<String, Object> getPatientExperience(UUID patientId) {
		var tenant = TenantContextHolder.require();
		var orgId = tenant.organizationId();
		var siteId = tenant.siteId();

		List<SatisfactionSurvey> surveys = surveyRepository
				.findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(orgId, siteId, patientId);

		var churnOpt = churnRepository
				.findTopByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(orgId, siteId, patientId);

		List<SatisfactionSurvey> completed = surveys.stream()
				.filter(s -> "COMPLETED".equals(s.getStatus())).toList();

		double avgNps = completed.stream()
				.filter(s -> s.getNpsScore() != null)
				.mapToInt(SatisfactionSurvey::getNpsScore)
				.average()
				.orElse(0.0);

		Map<String, Object> result = new LinkedHashMap<>();
		result.put("patientId", patientId);
		result.put("totalSurveys", surveys.size());
		result.put("completedSurveys", completed.size());
		result.put("averageNps", Math.round(avgNps * 100.0) / 100.0);
		result.put("latestCategory", completed.isEmpty() ? "NONE" : completed.get(0).npsCategory());
		churnOpt.ifPresent(c -> {
			result.put("churnRiskScore", c.getChurnScore());
			result.put("churnRiskLevel", c.getRiskLevel());
		});
		return result;
	}

	@Transactional(readOnly = true)
	public Map<String, Object> getSiteMetrics() {
		var tenant = TenantContextHolder.require();
		var orgId = tenant.organizationId();
		var siteId = tenant.siteId();

		Map<String, Object> npsData = calculateNpsScore(siteId);

		Instant since = Instant.now().minus(90, ChronoUnit.DAYS);
		List<SatisfactionSurvey> recentCompleted = surveyRepository
				.findByOrganizationIdAndSiteIdAndStatusAndCompletedAtAfter(
						orgId, siteId, "COMPLETED", since);

		double avgSatisfaction = recentCompleted.stream()
				.filter(s -> s.getSatisfaction() != null)
				.mapToDouble(s -> s.getSatisfaction().doubleValue())
				.average()
				.orElse(0.0);

		List<ChurnPrediction> recentChurn = churnRepository
				.findByOrganizationIdAndSiteIdOrderByCreatedAtDesc(orgId, siteId);

		long lowRisk = recentChurn.stream().filter(c -> "LOW".equals(c.getRiskLevel())).count();
		long mediumRisk = recentChurn.stream().filter(c -> "MEDIUM".equals(c.getRiskLevel())).count();
		long highRisk = recentChurn.stream().filter(c -> "HIGH".equals(c.getRiskLevel())).count();
		long criticalRisk = recentChurn.stream().filter(c -> "CRITICAL".equals(c.getRiskLevel())).count();

		Map<String, Object> result = new LinkedHashMap<>();
		result.put("nps", npsData);
		result.put("averageSatisfaction", Math.round(avgSatisfaction * 100.0) / 100.0);
		result.put("churnRiskDistribution", Map.of(
				"LOW", lowRisk, "MEDIUM", mediumRisk,
				"HIGH", highRisk, "CRITICAL", criticalRisk
		));
		result.put("totalChurnPredictions", recentChurn.size());
		return result;
	}
}

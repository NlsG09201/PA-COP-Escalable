package com.COP_Escalable.Backend.relapse.application;

import com.COP_Escalable.Backend.psychology.application.PsychologyService;
import com.COP_Escalable.Backend.psychology.domain.PsychologicalSnapshot;
import com.COP_Escalable.Backend.relapse.domain.RelapseAlert;
import com.COP_Escalable.Backend.relapse.infrastructure.RelapseAlertRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class RelapseService {

	private static final Logger log = LoggerFactory.getLogger(RelapseService.class);

	private static final double WEIGHT_SESSION_FREQUENCY = 0.30;
	private static final double WEIGHT_EMOTION_TREND = 0.25;
	private static final double WEIGHT_THERAPY_SCORE_AVG = 0.20;
	private static final double WEIGHT_DAYS_SINCE_SESSION = 0.25;

	private final RelapseAlertRepository alertRepository;
	private final PsychologyService psychologyService;
	private final ObjectMapper objectMapper;
	private final RestClient restClient;

	public RelapseService(RelapseAlertRepository alertRepository,
						  PsychologyService psychologyService,
						  ObjectMapper objectMapper,
						  RestClient.Builder restClientBuilder) {
		this.alertRepository = alertRepository;
		this.psychologyService = psychologyService;
		this.objectMapper = objectMapper;
		this.restClient = restClientBuilder.baseUrl("http://localhost:8000").build();
	}

	@Transactional
	public RelapseAlert assessRisk(UUID patientId) {
		var tenant = TenantContextHolder.require();
		var orgId = tenant.organizationId();
		var siteId = tenant.siteId();

		List<PsychologicalSnapshot> snapshots = psychologyService.getPatientEvolution(patientId);

		double score;
		Map<String, Object> factors;

		try {
			var response = callPredictionService(patientId, snapshots);
			score = ((Number) response.getOrDefault("risk_score", 0.5)).doubleValue();
			factors = response;
		} catch (Exception e) {
			log.warn("Recommendation engine unavailable, falling back to rule-based scoring: {}", e.getMessage());
			var ruleResult = ruleBasedScoring(snapshots);
			score = ruleResult.score();
			factors = ruleResult.factors();
		}

		score = Math.max(0.0, Math.min(1.0, score));
		String riskLevel = mapScoreToLevel(score);
		String actionsJson = generateActions(riskLevel);

		String factorsJsonStr;
		try {
			factorsJsonStr = objectMapper.writeValueAsString(factors);
		} catch (Exception e) {
			factorsJsonStr = "{}";
		}

		RelapseAlert alert = RelapseAlert.create(
				orgId, siteId, patientId,
				BigDecimal.valueOf(score).setScale(4, RoundingMode.HALF_UP),
				riskLevel, factorsJsonStr, actionsJson
		);

		return alertRepository.save(alert);
	}

	@Transactional(readOnly = true)
	public Optional<RelapseAlert> getLatestRisk(UUID patientId) {
		var tenant = TenantContextHolder.require();
		return alertRepository.findTopByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
				tenant.organizationId(), tenant.siteId(), patientId);
	}

	@Transactional(readOnly = true)
	public List<RelapseAlert> getRiskTrend(UUID patientId) {
		var tenant = TenantContextHolder.require();
		return alertRepository.findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
				tenant.organizationId(), tenant.siteId(), patientId);
	}

	@Transactional
	public RelapseAlert acknowledgeAlert(UUID alertId, UUID userId) {
		var alert = alertRepository.findById(alertId)
				.orElseThrow(() -> new IllegalArgumentException("Alert not found"));
		alert.acknowledge(userId);
		return alertRepository.save(alert);
	}

	@SuppressWarnings("unchecked")
	private Map<String, Object> callPredictionService(UUID patientId, List<PsychologicalSnapshot> snapshots) {
		var payload = Map.of(
				"patient_id", patientId.toString(),
				"snapshot_count", snapshots.size(),
				"latest_sentiment_score", snapshots.isEmpty() ? 0.0
						: snapshots.getFirst().getSentimentScore() != null ? snapshots.getFirst().getSentimentScore() : 0.0
		);
		return restClient.post()
				.uri("/api/relapse/predict")
				.body(payload)
				.retrieve()
				.body(Map.class);
	}

	private RuleBasedResult ruleBasedScoring(List<PsychologicalSnapshot> snapshots) {
		Map<String, Object> factors = new LinkedHashMap<>();

		double sessionFrequencyRisk = snapshots.size() < 3 ? 0.8 : snapshots.size() < 6 ? 0.4 : 0.1;
		factors.put("session_frequency", sessionFrequencyRisk);

		double emotionTrendRisk = 0.5;
		if (snapshots.size() >= 2) {
			var latest = snapshots.getFirst();
			var previous = snapshots.get(snapshots.size() / 2);
			double latentScore = latest.getSentimentScore() != null ? latest.getSentimentScore() : 0.0;
			double prevScore = previous.getSentimentScore() != null ? previous.getSentimentScore() : 0.0;
			double delta = latentScore - prevScore;
			emotionTrendRisk = delta < -0.3 ? 0.9 : delta < 0 ? 0.6 : delta < 0.2 ? 0.4 : 0.1;
		}
		factors.put("emotion_trend", emotionTrendRisk);

		double therapyScoreAvg = 0.5;
		if (!snapshots.isEmpty()) {
			double totalWellbeing = 0;
			int count = 0;
			for (var snap : snapshots) {
				if (snap.getMetrics() != null && snap.getMetrics().containsKey("wellbeing")) {
					totalWellbeing += snap.getMetrics().get("wellbeing");
					count++;
				}
			}
			if (count > 0) {
				double avg = totalWellbeing / count;
				therapyScoreAvg = 1.0 - avg;
			}
		}
		factors.put("therapy_score_avg", therapyScoreAvg);

		double daysSinceSessionRisk = 0.5;
		if (!snapshots.isEmpty()) {
			long daysSince = Duration.between(snapshots.getFirst().getOccurredAt(), Instant.now()).toDays();
			daysSinceSessionRisk = daysSince > 60 ? 0.9 : daysSince > 30 ? 0.7 : daysSince > 14 ? 0.4 : 0.1;
			factors.put("days_since_session", daysSince);
		}
		factors.put("days_since_session_risk", daysSinceSessionRisk);

		double score = sessionFrequencyRisk * WEIGHT_SESSION_FREQUENCY
				+ emotionTrendRisk * WEIGHT_EMOTION_TREND
				+ therapyScoreAvg * WEIGHT_THERAPY_SCORE_AVG
				+ daysSinceSessionRisk * WEIGHT_DAYS_SINCE_SESSION;

		return new RuleBasedResult(score, factors);
	}

	private static String mapScoreToLevel(double score) {
		if (score < 0.3) return "LOW";
		if (score < 0.5) return "MEDIUM";
		if (score < 0.7) return "HIGH";
		return "CRITICAL";
	}

	private String generateActions(String riskLevel) {
		try {
			List<String> actions = switch (riskLevel) {
				case "CRITICAL" -> List.of("Immediate clinical review", "Schedule emergency session",
						"Notify care team", "Activate safety protocol");
				case "HIGH" -> List.of("Schedule follow-up within 48h", "Increase session frequency",
						"Review treatment plan");
				case "MEDIUM" -> List.of("Monitor at next appointment", "Consider additional support resources");
				default -> List.of("Continue current treatment plan", "Routine monitoring");
			};
			return objectMapper.writeValueAsString(actions);
		} catch (Exception e) {
			return "[]";
		}
	}

	private record RuleBasedResult(double score, Map<String, Object> factors) {}
}

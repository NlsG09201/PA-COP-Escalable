package com.COP_Escalable.Backend.therapy.application;

import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import com.COP_Escalable.Backend.therapy.domain.TherapyModuleEntity;
import com.COP_Escalable.Backend.therapy.domain.TherapySession;
import com.COP_Escalable.Backend.therapy.infrastructure.TherapyModuleRepository;
import com.COP_Escalable.Backend.therapy.infrastructure.TherapySessionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TherapyService {

	private static final Logger log = LoggerFactory.getLogger(TherapyService.class);

	private final TherapyModuleRepository moduleRepository;
	private final TherapySessionRepository sessionRepository;
	private final TherapyProperties properties;
	private final ObjectMapper objectMapper;

	public TherapyService(TherapyModuleRepository moduleRepository,
						  TherapySessionRepository sessionRepository,
						  TherapyProperties properties,
						  ObjectMapper objectMapper) {
		this.moduleRepository = moduleRepository;
		this.sessionRepository = sessionRepository;
		this.properties = properties;
		this.objectMapper = objectMapper;
	}

	@Transactional(readOnly = true)
	public List<TherapyModuleEntity> getAvailableModules(String category) {
		if (category != null && !category.isBlank()) {
			return moduleRepository.findByCategoryAndActiveTrue(category.toUpperCase());
		}
		return moduleRepository.findByActiveTrue();
	}

	@Transactional
	public TherapySession startSession(UUID patientId, UUID moduleId) {
		var tenant = TenantContextHolder.require();

		Instant startOfDay = LocalDate.now().atStartOfDay(ZoneOffset.UTC).toInstant();
		long todaySessions = sessionRepository.countByOrganizationIdAndSiteIdAndPatientIdAndCreatedAtAfter(
				tenant.organizationId(), tenant.siteId(), patientId, startOfDay);
		if (todaySessions >= properties.getMaxDailySessions()) {
			throw new IllegalStateException(
					"Daily session limit reached (" + properties.getMaxDailySessions() + "). Try again tomorrow.");
		}

		TherapyModuleEntity module = moduleRepository.findById(moduleId)
				.orElseThrow(() -> new IllegalArgumentException("Therapy module not found: " + moduleId));

		if (!module.isActive()) {
			throw new IllegalStateException("Therapy module is not active: " + module.getCode());
		}

		var session = new TherapySession(tenant.organizationId(), tenant.siteId(), patientId, moduleId);
		var saved = sessionRepository.save(session);
		log.info("Started therapy session {} for patient {} module {}", saved.getId(), patientId, module.getCode());
		return saved;
	}

	@Transactional
	public TherapySession completeExercise(UUID sessionId, Map<String, Object> responses) {
		var session = sessionRepository.findById(sessionId)
				.orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

		if (!"IN_PROGRESS".equals(session.getStatus())) {
			throw new IllegalStateException("Session is not in progress: " + session.getStatus());
		}

		String responsesJson;
		try {
			responsesJson = objectMapper.writeValueAsString(responses);
		} catch (JsonProcessingException e) {
			throw new RuntimeException("Failed to serialize responses", e);
		}

		BigDecimal score = calculateScore(session.getModuleId(), responses);
		int durationSec = (int) Duration.between(session.getStartedAt(), Instant.now()).getSeconds();

		session.complete(responsesJson, score, durationSec);
		var saved = sessionRepository.save(session);
		log.info("Completed therapy session {} with score {} in {}s", sessionId, score, durationSec);
		return saved;
	}

	@Transactional
	public TherapySession abandonSession(UUID sessionId) {
		var session = sessionRepository.findById(sessionId)
				.orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

		if (!"IN_PROGRESS".equals(session.getStatus())) {
			throw new IllegalStateException("Session is not in progress: " + session.getStatus());
		}

		session.abandon();
		return sessionRepository.save(session);
	}

	@Transactional(readOnly = true)
	public List<TherapySession> getPatientSessions(UUID patientId) {
		var tenant = TenantContextHolder.require();
		return sessionRepository.findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
				tenant.organizationId(), tenant.siteId(), patientId
		);
	}

	@Transactional(readOnly = true)
	public PatientProgress getPatientProgress(UUID patientId) {
		var tenant = TenantContextHolder.require();
		List<TherapySession> sessions = sessionRepository
				.findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
						tenant.organizationId(), tenant.siteId(), patientId
				);

		long totalSessions = sessions.stream()
				.filter(s -> "COMPLETED".equals(s.getStatus()))
				.count();

		BigDecimal avgScore = sessions.stream()
				.filter(s -> s.getScore() != null)
				.map(TherapySession::getScore)
				.reduce(BigDecimal.ZERO, BigDecimal::add);
		if (totalSessions > 0) {
			avgScore = avgScore.divide(BigDecimal.valueOf(totalSessions), 2, RoundingMode.HALF_UP);
		}

		Map<String, Long> sessionsByCategory = new LinkedHashMap<>();
		for (TherapySession session : sessions) {
			if ("COMPLETED".equals(session.getStatus())) {
				moduleRepository.findById(session.getModuleId()).ifPresent(mod ->
						sessionsByCategory.merge(mod.getCategory(), 1L, Long::sum));
			}
		}

		int streak = calculateStreak(sessions);

		return new PatientProgress(totalSessions, avgScore, sessionsByCategory, streak);
	}

	private BigDecimal calculateScore(UUID moduleId, Map<String, Object> responses) {
		TherapyModuleEntity module = moduleRepository.findById(moduleId).orElse(null);
		if (module == null || responses == null || responses.isEmpty()) {
			return BigDecimal.ZERO;
		}

		String category = module.getCategory();
		return switch (category) {
			case "BREATHING" -> scoreBreathingExercise(responses);
			case "MINDFULNESS" -> scoreMindfulnessExercise(responses);
			case "CBT" -> scoreCbtExercise(responses);
			case "JOURNALING" -> scoreJournalingExercise(responses);
			case "RELAXATION" -> scoreRelaxationExercise(responses);
			default -> new BigDecimal("5.00");
		};
	}

	private BigDecimal scoreBreathingExercise(Map<String, Object> responses) {
		int completedCycles = getIntValue(responses, "completedCycles", 0);
		int totalCycles = getIntValue(responses, "totalCycles", 4);
		BigDecimal calmRating = getDecimalValue(responses, "calmRating", BigDecimal.valueOf(5));

		BigDecimal completionRatio = totalCycles > 0
				? BigDecimal.valueOf(completedCycles).divide(BigDecimal.valueOf(totalCycles), 2, RoundingMode.HALF_UP)
				: BigDecimal.ONE;
		return completionRatio.multiply(BigDecimal.TEN)
				.multiply(new BigDecimal("0.5"))
				.add(calmRating.multiply(new BigDecimal("0.5")))
				.setScale(2, RoundingMode.HALF_UP);
	}

	private BigDecimal scoreMindfulnessExercise(Map<String, Object> responses) {
		BigDecimal awarenessRating = getDecimalValue(responses, "awarenessRating", BigDecimal.valueOf(5));
		BigDecimal focusRating = getDecimalValue(responses, "focusRating", BigDecimal.valueOf(5));
		boolean completed = getBoolValue(responses, "completed", true);
		BigDecimal base = awarenessRating.add(focusRating).divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
		return completed ? base : base.multiply(new BigDecimal("0.7")).setScale(2, RoundingMode.HALF_UP);
	}

	private BigDecimal scoreCbtExercise(Map<String, Object> responses) {
		boolean identifiedThought = getBoolValue(responses, "identifiedThought", false);
		boolean foundEvidence = getBoolValue(responses, "foundEvidence", false);
		boolean reframed = getBoolValue(responses, "reframed", false);
		BigDecimal emotionChange = getDecimalValue(responses, "emotionChange", BigDecimal.ZERO);

		int points = 0;
		if (identifiedThought) points += 3;
		if (foundEvidence) points += 3;
		if (reframed) points += 2;
		BigDecimal base = BigDecimal.valueOf(points);
		return base.add(emotionChange.min(BigDecimal.valueOf(2))).setScale(2, RoundingMode.HALF_UP);
	}

	private BigDecimal scoreJournalingExercise(Map<String, Object> responses) {
		String text = (String) responses.getOrDefault("text", "");
		int wordCount = text.isBlank() ? 0 : text.trim().split("\\s+").length;

		BigDecimal lengthScore;
		if (wordCount >= 200) lengthScore = BigDecimal.TEN;
		else if (wordCount >= 100) lengthScore = new BigDecimal("8");
		else if (wordCount >= 50) lengthScore = new BigDecimal("6");
		else if (wordCount >= 20) lengthScore = new BigDecimal("4");
		else lengthScore = new BigDecimal("2");

		BigDecimal reflectionRating = getDecimalValue(responses, "reflectionRating", BigDecimal.valueOf(5));
		return lengthScore.multiply(new BigDecimal("0.6"))
				.add(reflectionRating.multiply(new BigDecimal("0.4")))
				.setScale(2, RoundingMode.HALF_UP);
	}

	private BigDecimal scoreRelaxationExercise(Map<String, Object> responses) {
		int completedGroups = getIntValue(responses, "completedGroups", 0);
		int totalGroups = getIntValue(responses, "totalGroups", 11);
		BigDecimal relaxationRating = getDecimalValue(responses, "relaxationRating", BigDecimal.valueOf(5));

		BigDecimal ratio = totalGroups > 0
				? BigDecimal.valueOf(completedGroups).divide(BigDecimal.valueOf(totalGroups), 2, RoundingMode.HALF_UP)
				: BigDecimal.ONE;
		return ratio.multiply(BigDecimal.TEN)
				.multiply(new BigDecimal("0.6"))
				.add(relaxationRating.multiply(new BigDecimal("0.4")))
				.setScale(2, RoundingMode.HALF_UP);
	}

	private int calculateStreak(List<TherapySession> sessions) {
		Set<LocalDate> activeDays = sessions.stream()
				.filter(s -> "COMPLETED".equals(s.getStatus()))
				.map(s -> s.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate())
				.collect(Collectors.toSet());

		if (activeDays.isEmpty()) return 0;

		int streak = 0;
		LocalDate day = LocalDate.now();
		while (activeDays.contains(day) || (streak == 0 && activeDays.contains(day.minusDays(1)))) {
			if (activeDays.contains(day)) {
				streak++;
			}
			day = day.minusDays(1);
		}
		return streak;
	}

	private int getIntValue(Map<String, Object> map, String key, int defaultVal) {
		Object val = map.get(key);
		if (val instanceof Number n) return n.intValue();
		if (val instanceof String s) {
			try { return Integer.parseInt(s); } catch (NumberFormatException e) { return defaultVal; }
		}
		return defaultVal;
	}

	private BigDecimal getDecimalValue(Map<String, Object> map, String key, BigDecimal defaultVal) {
		Object val = map.get(key);
		if (val instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
		if (val instanceof String s) {
			try { return new BigDecimal(s); } catch (NumberFormatException e) { return defaultVal; }
		}
		return defaultVal;
	}

	private boolean getBoolValue(Map<String, Object> map, String key, boolean defaultVal) {
		Object val = map.get(key);
		if (val instanceof Boolean b) return b;
		if (val instanceof String s) return Boolean.parseBoolean(s);
		return defaultVal;
	}

	public record PatientProgress(
			long totalSessions,
			BigDecimal avgScore,
			Map<String, Long> sessionsByCategory,
			int streak
	) {}
}

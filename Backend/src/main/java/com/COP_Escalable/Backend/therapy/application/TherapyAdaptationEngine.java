package com.COP_Escalable.Backend.therapy.application;

import com.COP_Escalable.Backend.psychology.domain.PsychologicalSnapshot;
import com.COP_Escalable.Backend.psychology.infrastructure.PsychologicalSnapshotRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import com.COP_Escalable.Backend.therapy.domain.TherapyModuleEntity;
import com.COP_Escalable.Backend.therapy.domain.TherapySession;
import com.COP_Escalable.Backend.therapy.infrastructure.TherapyModuleRepository;
import com.COP_Escalable.Backend.therapy.infrastructure.TherapySessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Component
public class TherapyAdaptationEngine {

	private static final Logger log = LoggerFactory.getLogger(TherapyAdaptationEngine.class);
	private static final BigDecimal HIGH_SCORE_THRESHOLD = new BigDecimal("7.5");
	private static final int RECENT_SESSION_LIMIT = 10;

	private final TherapyModuleRepository moduleRepository;
	private final TherapySessionRepository sessionRepository;
	private final PsychologicalSnapshotRepository snapshotRepository;

	public TherapyAdaptationEngine(TherapyModuleRepository moduleRepository,
								   TherapySessionRepository sessionRepository,
								   PsychologicalSnapshotRepository snapshotRepository) {
		this.moduleRepository = moduleRepository;
		this.sessionRepository = sessionRepository;
		this.snapshotRepository = snapshotRepository;
	}

	@Transactional(readOnly = true)
	public TherapyModuleEntity recommendNextExercise(UUID patientId) {
		var tenant = TenantContextHolder.require();

		Optional<PsychologicalSnapshot> latestSnapshot =
				snapshotRepository.findTopByPatientIdOrderByOccurredAtDesc(patientId);

		String recommendedCategory = determineCategory(latestSnapshot.orElse(null));
		String recommendedDifficulty = determineDifficulty(patientId, tenant.organizationId(), tenant.siteId());

		List<TherapyModuleEntity> candidates = moduleRepository.findByCategoryAndActiveTrue(recommendedCategory);
		if (candidates.isEmpty()) {
			candidates = moduleRepository.findByActiveTrue();
		}

		Set<UUID> recentModuleIds = getRecentModuleIds(patientId, tenant.organizationId(), tenant.siteId());
		List<TherapyModuleEntity> fresh = candidates.stream()
				.filter(m -> !recentModuleIds.contains(m.getId()))
				.toList();

		List<TherapyModuleEntity> pool = fresh.isEmpty() ? candidates : fresh;

		List<TherapyModuleEntity> difficultyMatch = pool.stream()
				.filter(m -> m.getDifficulty().equals(recommendedDifficulty))
				.toList();
		if (!difficultyMatch.isEmpty()) {
			pool = difficultyMatch;
		}

		TherapyModuleEntity selected = pool.get(new Random().nextInt(pool.size()));
		log.info("Recommended module {} (category={}, difficulty={}) for patient {}",
				selected.getCode(), selected.getCategory(), selected.getDifficulty(), patientId);
		return selected;
	}

	private String determineCategory(PsychologicalSnapshot snapshot) {
		if (snapshot == null || snapshot.getMetrics() == null) {
			return "BREATHING";
		}

		Map<String, Double> metrics = snapshot.getMetrics();
		double anxiety = metrics.getOrDefault("anxiety", 0.0);
		double depression = metrics.getOrDefault("depression", 0.0);
		double wellbeing = metrics.getOrDefault("wellbeing", 0.5);
		double stress = metrics.getOrDefault("stress", 0.0);

		if (anxiety > 0.6 || stress > 0.7) {
			return "BREATHING";
		}

		if (depression > 0.5 || wellbeing < 0.3) {
			return Math.random() > 0.5 ? "MINDFULNESS" : "JOURNALING";
		}

		String sentiment = snapshot.getPredominantSentiment();
		if ("negative".equalsIgnoreCase(sentiment)) {
			return "CBT";
		}

		List<String> options = List.of("BREATHING", "MINDFULNESS", "JOURNALING", "CBT", "RELAXATION");
		return options.get(new Random().nextInt(options.size()));
	}

	private String determineDifficulty(UUID patientId, UUID orgId, UUID siteId) {
		List<TherapySession> sessions = sessionRepository
				.findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(orgId, siteId, patientId);

		List<TherapySession> recent = sessions.stream()
				.filter(s -> "COMPLETED".equals(s.getStatus()) && s.getScore() != null)
				.limit(RECENT_SESSION_LIMIT)
				.toList();

		if (recent.size() < 3) {
			return "BEGINNER";
		}

		BigDecimal avgScore = recent.stream()
				.map(TherapySession::getScore)
				.reduce(BigDecimal.ZERO, BigDecimal::add)
				.divide(BigDecimal.valueOf(recent.size()), 2, java.math.RoundingMode.HALF_UP);

		if (avgScore.compareTo(HIGH_SCORE_THRESHOLD) > 0 && recent.size() >= 5) {
			return "ADVANCED";
		}
		if (avgScore.compareTo(new BigDecimal("5.0")) > 0) {
			return "INTERMEDIATE";
		}
		return "BEGINNER";
	}

	private Set<UUID> getRecentModuleIds(UUID patientId, UUID orgId, UUID siteId) {
		return sessionRepository
				.findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(orgId, siteId, patientId)
				.stream()
				.limit(5)
				.map(TherapySession::getModuleId)
				.collect(Collectors.toSet());
	}
}

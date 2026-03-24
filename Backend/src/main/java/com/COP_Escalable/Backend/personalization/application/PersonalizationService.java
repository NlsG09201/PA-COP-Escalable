package com.COP_Escalable.Backend.personalization.application;

import com.COP_Escalable.Backend.experience.domain.SatisfactionSurvey;
import com.COP_Escalable.Backend.experience.infrastructure.SatisfactionSurveyRepository;
import com.COP_Escalable.Backend.personalization.domain.PatientPreferenceProfile;
import com.COP_Escalable.Backend.personalization.infrastructure.PatientPreferenceProfileRepository;
import com.COP_Escalable.Backend.psychology.domain.PsychologicalSnapshot;
import com.COP_Escalable.Backend.psychology.infrastructure.PsychologicalSnapshotRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PersonalizationService {

	private final PatientPreferenceProfileRepository profileRepository;
	private final PsychologicalSnapshotRepository snapshotRepository;
	private final SatisfactionSurveyRepository surveyRepository;

	public PersonalizationService(PatientPreferenceProfileRepository profileRepository,
								  PsychologicalSnapshotRepository snapshotRepository,
								  SatisfactionSurveyRepository surveyRepository) {
		this.profileRepository = profileRepository;
		this.snapshotRepository = snapshotRepository;
		this.surveyRepository = surveyRepository;
	}

	@Transactional
	public PatientPreferenceProfile calculateProfile(UUID patientId) {
		var tenant = TenantContextHolder.require();
		var orgId = tenant.organizationId();
		var siteId = tenant.siteId();

		var snapshots = snapshotRepository
				.findAllByOrganizationIdAndSiteIdAndPatientIdOrderByOccurredAtDesc(orgId, siteId, patientId);

		var surveys = surveyRepository
				.findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(orgId, siteId, patientId);

		List<String> therapyCategories = analyzeTherapyPreferences(snapshots);
		String communicationPref = analyzeCommunicationPreference(surveys);
		List<String> appointmentTimes = analyzeAppointmentTimePreferences(snapshots);
		String engagement = calculateEngagementLevel(snapshots, surveys);
		Map<String, Double> factors = calculateAdaptationFactors(snapshots);

		var profile = profileRepository.findByOrganizationIdAndSiteIdAndPatientId(orgId, siteId, patientId)
				.orElseGet(() -> new PatientPreferenceProfile(orgId, siteId, patientId));

		profile.recalculate(therapyCategories, communicationPref, appointmentTimes, engagement, factors);
		return profileRepository.save(profile);
	}

	@Transactional(readOnly = true)
	public PatientPreferenceProfile getProfile(UUID patientId) {
		var tenant = TenantContextHolder.require();
		return profileRepository.findByOrganizationIdAndSiteIdAndPatientId(
				tenant.organizationId(), tenant.siteId(), patientId
		).orElseGet(() -> calculateProfile(patientId));
	}

	@Transactional(readOnly = true)
	public Map<String, Object> getPersonalizedRecommendations(UUID patientId) {
		var tenant = TenantContextHolder.require();
		var orgId = tenant.organizationId();
		var siteId = tenant.siteId();

		var profileOpt = profileRepository.findByOrganizationIdAndSiteIdAndPatientId(orgId, siteId, patientId);
		PatientPreferenceProfile profile = profileOpt.orElseGet(() -> calculateProfile(patientId));

		var snapshots = snapshotRepository
				.findAllByOrganizationIdAndSiteIdAndPatientIdOrderByOccurredAtDesc(orgId, siteId, patientId);

		Map<String, Object> recommendations = new LinkedHashMap<>();

		recommendations.put("therapyRecommendations", buildTherapyRecommendations(profile, snapshots));
		recommendations.put("schedulingRecommendations", buildSchedulingRecommendations(profile));
		recommendations.put("communicationRecommendations", buildCommunicationRecommendations(profile));
		recommendations.put("engagementStrategies", buildEngagementStrategies(profile));
		recommendations.put("profileSummary", Map.of(
				"engagementLevel", profile.getEngagementLevel() != null ? profile.getEngagementLevel() : "UNKNOWN",
				"preferredCategories", profile.getPreferredTherapyCategories(),
				"communicationChannel", profile.getCommunicationPreference() != null
						? profile.getCommunicationPreference() : "IN_APP"
		));

		return recommendations;
	}

	private List<String> analyzeTherapyPreferences(List<PsychologicalSnapshot> snapshots) {
		Map<String, Integer> sourceCounts = new HashMap<>();
		for (var snapshot : snapshots) {
			if (snapshot.getSource() != null) {
				String category = extractCategory(snapshot.getSource());
				sourceCounts.merge(category, 1, Integer::sum);
			}
		}

		return sourceCounts.entrySet().stream()
				.sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
				.limit(3)
				.map(Map.Entry::getKey)
				.toList();
	}

	private String analyzeCommunicationPreference(List<SatisfactionSurvey> surveys) {
		long completedCount = surveys.stream().filter(s -> "COMPLETED".equals(s.getStatus())).count();
		long totalCount = surveys.size();

		if (totalCount == 0) return "IN_APP";

		double responseRate = (double) completedCount / totalCount;
		if (responseRate > 0.7) return "EMAIL";
		if (responseRate > 0.4) return "WHATSAPP";
		return "IN_APP";
	}

	private List<String> analyzeAppointmentTimePreferences(List<PsychologicalSnapshot> snapshots) {
		Map<String, Integer> timeCounts = new HashMap<>();
		for (var snapshot : snapshots) {
			if (snapshot.getOccurredAt() != null) {
				int hour = snapshot.getOccurredAt().atZone(java.time.ZoneId.systemDefault()).getHour();
				String timeSlot;
				if (hour < 12) timeSlot = "MORNING";
				else if (hour < 17) timeSlot = "AFTERNOON";
				else timeSlot = "EVENING";
				timeCounts.merge(timeSlot, 1, Integer::sum);
			}
		}

		return timeCounts.entrySet().stream()
				.sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
				.map(Map.Entry::getKey)
				.toList();
	}

	private String calculateEngagementLevel(List<PsychologicalSnapshot> snapshots,
											List<SatisfactionSurvey> surveys) {
		int score = 0;

		if (snapshots.size() >= 10) score += 3;
		else if (snapshots.size() >= 5) score += 2;
		else if (!snapshots.isEmpty()) score += 1;

		long completedSurveys = surveys.stream().filter(s -> "COMPLETED".equals(s.getStatus())).count();
		if (completedSurveys >= 3) score += 2;
		else if (completedSurveys >= 1) score += 1;

		if (score >= 4) return "HIGH";
		if (score >= 2) return "MEDIUM";
		return "LOW";
	}

	private Map<String, Double> calculateAdaptationFactors(List<PsychologicalSnapshot> snapshots) {
		Map<String, Double> factors = new HashMap<>();

		if (snapshots.size() >= 2) {
			var latest = snapshots.getFirst();
			var earliest = snapshots.getLast();

			double latestWellbeing = latest.getMetrics() != null
					? latest.getMetrics().getOrDefault("wellbeing", 0.5) : 0.5;
			double earliestWellbeing = earliest.getMetrics() != null
					? earliest.getMetrics().getOrDefault("wellbeing", 0.5) : 0.5;

			double trend = latestWellbeing - earliestWellbeing;
			if (trend > 0.1) {
				factors.put("therapy_difficulty_modifier", 1.1);
			} else if (trend < -0.1) {
				factors.put("therapy_difficulty_modifier", 0.9);
			} else {
				factors.put("therapy_difficulty_modifier", 1.0);
			}
		} else {
			factors.put("therapy_difficulty_modifier", 1.0);
		}

		double avgSnapInterval = snapshots.size() >= 2
				? java.time.Duration.between(snapshots.getLast().getOccurredAt(),
				snapshots.getFirst().getOccurredAt()).toDays() / (double) (snapshots.size() - 1)
				: 7.0;

		if (avgSnapInterval < 5) {
			factors.put("session_duration_modifier", 0.9);
		} else if (avgSnapInterval > 14) {
			factors.put("session_duration_modifier", 1.2);
		} else {
			factors.put("session_duration_modifier", 1.0);
		}

		return factors;
	}

	private List<Map<String, String>> buildTherapyRecommendations(PatientPreferenceProfile profile,
																  List<PsychologicalSnapshot> snapshots) {
		List<Map<String, String>> recs = new ArrayList<>();

		if (profile.getPreferredTherapyCategories().isEmpty()) {
			recs.add(Map.of(
					"type", "INITIAL_ASSESSMENT",
					"description", "Complete initial psychological assessment to determine therapy preferences"
			));
			return recs;
		}

		for (String category : profile.getPreferredTherapyCategories()) {
			recs.add(Map.of(
					"type", "PREFERRED_CATEGORY",
					"category", category,
					"description", "Patient responds well to " + category + " based on historical data"
			));
		}

		if (!snapshots.isEmpty()) {
			var latest = snapshots.getFirst();
			if (latest.getMetrics() != null) {
				Double anxiety = latest.getMetrics().get("anxiety");
				if (anxiety != null && anxiety > 0.6) {
					recs.add(Map.of(
							"type", "CLINICAL_INDICATOR",
							"description", "Elevated anxiety detected - consider anxiety-focused interventions"
					));
				}
				Double depression = latest.getMetrics().get("depression");
				if (depression != null && depression > 0.6) {
					recs.add(Map.of(
							"type", "CLINICAL_INDICATOR",
							"description", "Depression indicators elevated - consider mood-focused therapy"
					));
				}
			}
		}

		return recs;
	}

	private List<Map<String, String>> buildSchedulingRecommendations(PatientPreferenceProfile profile) {
		List<Map<String, String>> recs = new ArrayList<>();
		var times = profile.getPreferredAppointmentTimes();
		if (!times.isEmpty()) {
			recs.add(Map.of(
					"preferredTime", times.getFirst(),
					"description", "Patient typically engages during " + times.getFirst().toLowerCase() + " hours"
			));
		}

		Double durationMod = profile.getAdaptationFactors().get("session_duration_modifier");
		if (durationMod != null && durationMod != 1.0) {
			String adjustment = durationMod > 1.0 ? "longer" : "shorter";
			recs.add(Map.of(
					"description", "Consider " + adjustment + " session durations based on patient pattern"
			));
		}
		return recs;
	}

	private Map<String, String> buildCommunicationRecommendations(PatientPreferenceProfile profile) {
		String channel = profile.getCommunicationPreference() != null
				? profile.getCommunicationPreference() : "IN_APP";
		return Map.of(
				"preferredChannel", channel,
				"description", "Use " + channel + " for appointment reminders and follow-ups"
		);
	}

	private List<String> buildEngagementStrategies(PatientPreferenceProfile profile) {
		String level = profile.getEngagementLevel() != null ? profile.getEngagementLevel() : "LOW";
		return switch (level) {
			case "HIGH" -> List.of(
					"Maintain current engagement cadence",
					"Offer advanced self-management tools",
					"Consider peer support group referral"
			);
			case "MEDIUM" -> List.of(
					"Send regular progress updates",
					"Increase positive reinforcement frequency",
					"Provide educational content on treatment benefits"
			);
			default -> List.of(
					"Increase outreach frequency",
					"Simplify treatment goals into smaller milestones",
					"Consider motivational interviewing techniques",
					"Offer flexible scheduling options"
			);
		};
	}

	private String extractCategory(String source) {
		if (source == null) return "GENERAL";
		if (source.contains("SESSION")) return "SESSION_BASED";
		if (source.contains("TEST")) return "TEST_BASED";
		if (source.contains("AI_ASSIST")) return "AI_ASSISTED";
		if (source.contains("DIARY")) return "SELF_REPORTED";
		return "GENERAL";
	}
}

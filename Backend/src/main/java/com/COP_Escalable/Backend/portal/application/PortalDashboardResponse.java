package com.COP_Escalable.Backend.portal.application;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record PortalDashboardResponse(
		UUID patientId,
		ClinicalSummary clinicalSummary,
		List<TreatmentPlanView> activeTreatmentPlans,
		List<AppointmentView> upcomingAppointments,
		PsychologicalEvolutionView psychologicalEvolution
) {

	public record ClinicalSummary(
			UUID recordId,
			Instant lastUpdated,
			List<EntryView> recentEntries
	) {}

	public record EntryView(
			Instant at,
			String type,
			String note
	) {}

	public record TreatmentPlanView(
			UUID id,
			String name,
			String status,
			int totalSteps,
			int completedSteps,
			Instant createdAt
	) {}

	public record AppointmentView(
			UUID id,
			Instant startAt,
			Instant endAt,
			String status,
			String reason,
			String serviceName
	) {}

	public record PsychologicalEvolutionView(
			int snapshotCount,
			Map<String, Double> latestMetrics,
			String latestSentiment,
			Double latestSentimentScore
	) {}
}

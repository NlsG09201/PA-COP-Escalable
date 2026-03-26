package com.COP_Escalable.Backend.appointments.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.UUID;

@Document(collection = "appointment_assignment_audit")
public class AppointmentAssignmentAudit extends TenantScopedEntity {

	@Field("patient_id")
	private UUID patientId;

	@Field("appointment_type")
	private String appointmentType;

	private String priority;

	@Field("requested_start_at")
	private Instant requestedStartAt;

	@Field("requested_end_at")
	private Instant requestedEndAt;

	@Field("winner_professional_id")
	private UUID winnerProfessionalId;

	@Field("winner_score")
	private Double winnerScore;

	@Field("candidates_payload")
	private String candidatesPayload;

	@Field("alternatives_payload")
	private String alternativesPayload;

	private String outcome;

	protected AppointmentAssignmentAudit() {}

	public static AppointmentAssignmentAudit of(
			UUID organizationId,
			UUID siteId,
			UUID patientId,
			String appointmentType,
			String priority,
			Instant requestedStartAt,
			Instant requestedEndAt,
			UUID winnerProfessionalId,
			Double winnerScore,
			String candidatesPayload,
			String alternativesPayload,
			String outcome
	) {
		var audit = new AppointmentAssignmentAudit();
		audit.setTenant(organizationId, siteId);
		audit.patientId = patientId;
		audit.appointmentType = appointmentType;
		audit.priority = priority;
		audit.requestedStartAt = requestedStartAt;
		audit.requestedEndAt = requestedEndAt;
		audit.winnerProfessionalId = winnerProfessionalId;
		audit.winnerScore = winnerScore;
		audit.candidatesPayload = candidatesPayload;
		audit.alternativesPayload = alternativesPayload;
		audit.outcome = outcome;
		return audit;
	}
}

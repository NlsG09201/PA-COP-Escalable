package com.COP_Escalable.Backend.appointments.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "appointment_assignment_audit")
public class AppointmentAssignmentAudit extends TenantScopedEntity {

	@Column(nullable = false)
	private UUID patientId;

	@Column(nullable = false)
	private String appointmentType;

	@Column(nullable = false)
	private String priority;

	@Column(nullable = false)
	private Instant requestedStartAt;

	@Column(nullable = false)
	private Instant requestedEndAt;

	@Column
	private UUID winnerProfessionalId;

	@Column
	private Double winnerScore;

	@Column
	private String candidatesPayload;

	@Column
	private String alternativesPayload;

	@Column(nullable = false)
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

package com.COP_Escalable.Backend.followup.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Document(collection = "followup_schedules")
public class FollowupSchedule extends TenantScopedEntity {

	@Field("patient_id")
	private UUID patientId;

	@Field("survey_id")
	private UUID surveyId;

	@Field("appointment_id")
	private UUID appointmentId;

	private String reason;

	@Field("scheduled_date")
	private LocalDate scheduledDate;

	private String status;

	protected FollowupSchedule() {}

	public FollowupSchedule(UUID organizationId, UUID siteId, UUID patientId,
							String reason, LocalDate scheduledDate) {
		setTenant(organizationId, siteId);
		this.patientId = patientId;
		this.reason = reason;
		this.scheduledDate = scheduledDate;
		this.status = "PENDING";
	}

	public void linkSurvey(UUID surveyId) {
		this.surveyId = surveyId;
	}

	public void linkAppointment(UUID appointmentId) {
		this.appointmentId = appointmentId;
		this.status = "SCHEDULED";
	}

	public void markCompleted() {
		this.status = "COMPLETED";
	}

	public void cancel() {
		this.status = "CANCELLED";
	}

	public UUID getPatientId() {
		return patientId;
	}

	public UUID getSurveyId() {
		return surveyId;
	}

	public UUID getAppointmentId() {
		return appointmentId;
	}

	public String getReason() {
		return reason;
	}

	public LocalDate getScheduledDate() {
		return scheduledDate;
	}

	public String getStatus() {
		return status;
	}
}

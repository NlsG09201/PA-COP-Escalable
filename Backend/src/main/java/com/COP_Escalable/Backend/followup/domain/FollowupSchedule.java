package com.COP_Escalable.Backend.followup.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "followup_schedules")
public class FollowupSchedule {

	@Id
	@GeneratedValue
	private UUID id;

	@Column(name = "organization_id", nullable = false)
	private UUID organizationId;

	@Column(name = "site_id", nullable = false)
	private UUID siteId;

	@Column(name = "patient_id", nullable = false)
	private UUID patientId;

	@Column(name = "survey_id")
	private UUID surveyId;

	@Column(name = "appointment_id")
	private UUID appointmentId;

	@Column(name = "reason", nullable = false, columnDefinition = "TEXT")
	private String reason;

	@Column(name = "scheduled_date", nullable = false)
	private LocalDate scheduledDate;

	@Column(name = "status", nullable = false, length = 20)
	private String status;

	@CreationTimestamp
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected FollowupSchedule() {}

	public FollowupSchedule(UUID organizationId, UUID siteId, UUID patientId,
							String reason, LocalDate scheduledDate) {
		this.organizationId = organizationId;
		this.siteId = siteId;
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

	public UUID getId() { return id; }
	public UUID getOrganizationId() { return organizationId; }
	public UUID getSiteId() { return siteId; }
	public UUID getPatientId() { return patientId; }
	public UUID getSurveyId() { return surveyId; }
	public UUID getAppointmentId() { return appointmentId; }
	public String getReason() { return reason; }
	public LocalDate getScheduledDate() { return scheduledDate; }
	public String getStatus() { return status; }
	public Instant getCreatedAt() { return createdAt; }
}

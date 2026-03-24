package com.COP_Escalable.Backend.experience.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "satisfaction_surveys")
public class SatisfactionSurvey extends TenantScopedEntity {

	@Column(nullable = false)
	private UUID patientId;

	@Column(nullable = false, length = 20)
	private String surveyType;

	@Column(length = 100)
	private String triggerEvent;

	private Integer npsScore;

	@Column(precision = 5, scale = 2)
	private BigDecimal satisfaction;

	@Column(columnDefinition = "text")
	private String feedbackText;

	@Column(nullable = false, length = 20)
	private String status;

	private Instant sentAt;
	private Instant completedAt;

	protected SatisfactionSurvey() {}

	public static SatisfactionSurvey create(UUID organizationId, UUID siteId,
											UUID patientId, String surveyType, String triggerEvent) {
		var survey = new SatisfactionSurvey();
		survey.setTenant(organizationId, siteId);
		survey.patientId = patientId;
		survey.surveyType = surveyType;
		survey.triggerEvent = triggerEvent;
		survey.status = "PENDING";
		return survey;
	}

	public void markSent() {
		this.status = "SENT";
		this.sentAt = Instant.now();
	}

	public void complete(int npsScore, BigDecimal satisfaction, String feedbackText) {
		this.status = "COMPLETED";
		this.npsScore = npsScore;
		this.satisfaction = satisfaction;
		this.feedbackText = feedbackText;
		this.completedAt = Instant.now();
	}

	public void expire() {
		this.status = "EXPIRED";
	}

	public String npsCategory() {
		if (npsScore == null) return "UNKNOWN";
		if (npsScore >= 9) return "PROMOTER";
		if (npsScore >= 7) return "PASSIVE";
		return "DETRACTOR";
	}

	public UUID getPatientId() { return patientId; }
	public String getSurveyType() { return surveyType; }
	public String getTriggerEvent() { return triggerEvent; }
	public Integer getNpsScore() { return npsScore; }
	public BigDecimal getSatisfaction() { return satisfaction; }
	public String getFeedbackText() { return feedbackText; }
	public String getStatus() { return status; }
	public Instant getSentAt() { return sentAt; }
	public Instant getCompletedAt() { return completedAt; }
}

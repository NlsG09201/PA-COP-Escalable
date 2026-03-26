package com.COP_Escalable.Backend.experience.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Document(collection = "satisfaction_surveys")
public class SatisfactionSurvey extends TenantScopedEntity {

	@Field("patient_id")
	private UUID patientId;

	@Field("survey_type")
	private String surveyType;

	@Field("trigger_event")
	private String triggerEvent;

	@Field("nps_score")
	private Integer npsScore;

	private BigDecimal satisfaction;

	@Field("feedback_text")
	private String feedbackText;

	private String status;

	@Field("sent_at")
	private Instant sentAt;

	@Field("completed_at")
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

	public UUID getPatientId() {
		return patientId;
	}

	public String getSurveyType() {
		return surveyType;
	}

	public String getTriggerEvent() {
		return triggerEvent;
	}

	public Integer getNpsScore() {
		return npsScore;
	}

	public BigDecimal getSatisfaction() {
		return satisfaction;
	}

	public String getFeedbackText() {
		return feedbackText;
	}

	public String getStatus() {
		return status;
	}

	public Instant getSentAt() {
		return sentAt;
	}

	public Instant getCompletedAt() {
		return completedAt;
	}
}

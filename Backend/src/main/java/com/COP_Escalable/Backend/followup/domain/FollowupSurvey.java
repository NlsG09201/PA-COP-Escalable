package com.COP_Escalable.Backend.followup.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Document(collection = "followup_surveys")
public class FollowupSurvey extends TenantScopedEntity {

	@Field("patient_id")
	private UUID patientId;

	@Field("treatment_type")
	private String treatmentType;

	@Field("trigger_event")
	private String triggerEvent;

	private String status;

	@Field("scheduled_at")
	private Instant scheduledAt;

	@Field("completed_at")
	private Instant completedAt;

	private BigDecimal score;

	@Field("risk_detected")
	private boolean riskDetected;

	private List<FollowupSurveyQuestion> questions = new ArrayList<>();

	protected FollowupSurvey() {}

	public FollowupSurvey(UUID organizationId, UUID siteId, UUID patientId,
						   String treatmentType, String triggerEvent, Instant scheduledAt) {
		setTenant(organizationId, siteId);
		this.patientId = patientId;
		this.treatmentType = treatmentType;
		this.triggerEvent = triggerEvent;
		this.status = "PENDING";
		this.scheduledAt = scheduledAt;
		this.riskDetected = false;
	}

	public void addQuestion(String question, int sortOrder) {
		var q = new FollowupSurveyQuestion(question, sortOrder);
		q.ensureId();
		this.questions.add(q);
	}

	public void markCompleted(BigDecimal totalScore, boolean risk) {
		this.status = "COMPLETED";
		this.completedAt = Instant.now();
		this.score = totalScore;
		this.riskDetected = risk;
	}

	public void markExpired() {
		this.status = "EXPIRED";
	}

	public void markSent() {
		this.status = "SENT";
	}

	public UUID getPatientId() {
		return patientId;
	}

	public String getTreatmentType() {
		return treatmentType;
	}

	public String getTriggerEvent() {
		return triggerEvent;
	}

	public String getStatus() {
		return status;
	}

	public Instant getScheduledAt() {
		return scheduledAt;
	}

	public Instant getCompletedAt() {
		return completedAt;
	}

	public BigDecimal getScore() {
		return score;
	}

	public boolean isRiskDetected() {
		return riskDetected;
	}

	public List<FollowupSurveyQuestion> getQuestions() {
		return questions;
	}
}

package com.COP_Escalable.Backend.followup.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "followup_surveys")
public class FollowupSurvey {

	@Id
	@GeneratedValue
	private UUID id;

	@Column(name = "organization_id", nullable = false)
	private UUID organizationId;

	@Column(name = "site_id", nullable = false)
	private UUID siteId;

	@Column(name = "patient_id", nullable = false)
	private UUID patientId;

	@Column(name = "treatment_type", nullable = false, length = 50)
	private String treatmentType;

	@Column(name = "trigger_event", nullable = false, length = 100)
	private String triggerEvent;

	@Column(name = "status", nullable = false, length = 20)
	private String status;

	@Column(name = "scheduled_at", nullable = false)
	private Instant scheduledAt;

	@Column(name = "completed_at")
	private Instant completedAt;

	@Column(name = "score", precision = 5, scale = 2)
	private BigDecimal score;

	@Column(name = "risk_detected", nullable = false)
	private boolean riskDetected;

	@OneToMany(mappedBy = "survey", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("sortOrder ASC")
	private List<FollowupSurveyQuestion> questions = new ArrayList<>();

	@CreationTimestamp
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected FollowupSurvey() {}

	public FollowupSurvey(UUID organizationId, UUID siteId, UUID patientId,
						   String treatmentType, String triggerEvent, Instant scheduledAt) {
		this.organizationId = organizationId;
		this.siteId = siteId;
		this.patientId = patientId;
		this.treatmentType = treatmentType;
		this.triggerEvent = triggerEvent;
		this.status = "PENDING";
		this.scheduledAt = scheduledAt;
		this.riskDetected = false;
	}

	public void addQuestion(String question, int sortOrder) {
		var q = new FollowupSurveyQuestion(this, question, sortOrder);
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

	public UUID getId() { return id; }
	public UUID getOrganizationId() { return organizationId; }
	public UUID getSiteId() { return siteId; }
	public UUID getPatientId() { return patientId; }
	public String getTreatmentType() { return treatmentType; }
	public String getTriggerEvent() { return triggerEvent; }
	public String getStatus() { return status; }
	public Instant getScheduledAt() { return scheduledAt; }
	public Instant getCompletedAt() { return completedAt; }
	public BigDecimal getScore() { return score; }
	public boolean isRiskDetected() { return riskDetected; }
	public List<FollowupSurveyQuestion> getQuestions() { return questions; }
	public Instant getCreatedAt() { return createdAt; }
	public Instant getUpdatedAt() { return updatedAt; }
}

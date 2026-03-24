package com.COP_Escalable.Backend.therapy.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "therapy_sessions")
public class TherapySession {

	@Id
	@GeneratedValue
	private UUID id;

	@Column(name = "organization_id", nullable = false)
	private UUID organizationId;

	@Column(name = "site_id", nullable = false)
	private UUID siteId;

	@Column(name = "patient_id", nullable = false)
	private UUID patientId;

	@Column(name = "module_id", nullable = false)
	private UUID moduleId;

	@Column(name = "status", nullable = false, length = 20)
	private String status;

	@Column(name = "started_at", nullable = false)
	private Instant startedAt;

	@Column(name = "completed_at")
	private Instant completedAt;

	@Column(name = "score", precision = 5, scale = 2)
	private BigDecimal score;

	@Column(name = "duration_sec")
	private Integer durationSec;

	@Column(name = "responses_json", columnDefinition = "jsonb")
	private String responsesJson;

	@Column(name = "notes", columnDefinition = "TEXT")
	private String notes;

	@CreationTimestamp
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected TherapySession() {}

	public TherapySession(UUID organizationId, UUID siteId, UUID patientId, UUID moduleId) {
		this.organizationId = organizationId;
		this.siteId = siteId;
		this.patientId = patientId;
		this.moduleId = moduleId;
		this.status = "IN_PROGRESS";
		this.startedAt = Instant.now();
	}

	public void complete(String responsesJson, BigDecimal score, Integer durationSec) {
		this.status = "COMPLETED";
		this.completedAt = Instant.now();
		this.responsesJson = responsesJson;
		this.score = score;
		this.durationSec = durationSec;
	}

	public void abandon() {
		this.status = "ABANDONED";
		this.completedAt = Instant.now();
		if (this.durationSec == null) {
			this.durationSec = (int) java.time.Duration.between(this.startedAt, Instant.now()).getSeconds();
		}
	}

	public UUID getId() { return id; }
	public UUID getOrganizationId() { return organizationId; }
	public UUID getSiteId() { return siteId; }
	public UUID getPatientId() { return patientId; }
	public UUID getModuleId() { return moduleId; }
	public String getStatus() { return status; }
	public Instant getStartedAt() { return startedAt; }
	public Instant getCompletedAt() { return completedAt; }
	public BigDecimal getScore() { return score; }
	public Integer getDurationSec() { return durationSec; }
	public String getResponsesJson() { return responsesJson; }
	public String getNotes() { return notes; }
	public Instant getCreatedAt() { return createdAt; }
}

package com.COP_Escalable.Backend.therapy.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Document(collection = "therapy_sessions")
public class TherapySession {

	@Id
	private UUID id;

	@Field("organization_id")
	private UUID organizationId;

	@Field("site_id")
	private UUID siteId;

	@Field("patient_id")
	private UUID patientId;

	@Field("module_id")
	private UUID moduleId;

	private String status;

	@Field("started_at")
	private Instant startedAt;

	@Field("completed_at")
	private Instant completedAt;

	private BigDecimal score;

	@Field("duration_sec")
	private Integer durationSec;

	@Field("responses_json")
	private String responsesJson;

	private String notes;

	@Field("created_at")
	private Instant createdAt;

	protected TherapySession() {}

	public TherapySession(UUID organizationId, UUID siteId, UUID patientId, UUID moduleId) {
		this.id = UUID.randomUUID();
		this.organizationId = organizationId;
		this.siteId = siteId;
		this.patientId = patientId;
		this.moduleId = moduleId;
		this.status = "IN_PROGRESS";
		this.startedAt = Instant.now();
		this.createdAt = Instant.now();
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

	public UUID getId() {
		return id;
	}

	public UUID getOrganizationId() {
		return organizationId;
	}

	public UUID getSiteId() {
		return siteId;
	}

	public UUID getPatientId() {
		return patientId;
	}

	public UUID getModuleId() {
		return moduleId;
	}

	public String getStatus() {
		return status;
	}

	public Instant getStartedAt() {
		return startedAt;
	}

	public Instant getCompletedAt() {
		return completedAt;
	}

	public BigDecimal getScore() {
		return score;
	}

	public Integer getDurationSec() {
		return durationSec;
	}

	public String getResponsesJson() {
		return responsesJson;
	}

	public String getNotes() {
		return notes;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}

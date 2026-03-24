package com.COP_Escalable.Backend.diagnosis.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Document("diagnosis_results")
public class DiagnosisResult {

	public enum Status { COMPLETED, FAILED }

	@Id
	private UUID id;

	@Indexed
	private UUID organizationId;

	@Indexed
	private UUID siteId;

	@Indexed
	private UUID patientId;

	@Indexed
	private UUID imageId;

	private List<Finding> findings = new ArrayList<>();
	private String modelVersion;
	private long processingTimeMs;
	private Status status;
	private Instant createdAt;

	protected DiagnosisResult() {}

	public DiagnosisResult(UUID organizationId, UUID siteId, UUID patientId, UUID imageId,
						   List<Finding> findings, String modelVersion, long processingTimeMs, Status status) {
		this.id = UUID.randomUUID();
		this.organizationId = organizationId;
		this.siteId = siteId;
		this.patientId = patientId;
		this.imageId = imageId;
		this.findings = findings != null ? new ArrayList<>(findings) : new ArrayList<>();
		this.modelVersion = modelVersion;
		this.processingTimeMs = processingTimeMs;
		this.status = status;
		this.createdAt = Instant.now();
	}

	public static DiagnosisResult completed(UUID organizationId, UUID siteId, UUID patientId,
											UUID imageId, List<Finding> findings, String modelVersion, long processingTimeMs) {
		return new DiagnosisResult(organizationId, siteId, patientId, imageId, findings, modelVersion, processingTimeMs, Status.COMPLETED);
	}

	public static DiagnosisResult failed(UUID organizationId, UUID siteId, UUID patientId,
										 UUID imageId, String modelVersion, long processingTimeMs) {
		return new DiagnosisResult(organizationId, siteId, patientId, imageId, List.of(), modelVersion, processingTimeMs, Status.FAILED);
	}

	public UUID getId() { return id; }
	public UUID getOrganizationId() { return organizationId; }
	public UUID getSiteId() { return siteId; }
	public UUID getPatientId() { return patientId; }
	public UUID getImageId() { return imageId; }
	public List<Finding> getFindings() { return findings; }
	public String getModelVersion() { return modelVersion; }
	public long getProcessingTimeMs() { return processingTimeMs; }
	public Status getStatus() { return status; }
	public Instant getCreatedAt() { return createdAt; }
}

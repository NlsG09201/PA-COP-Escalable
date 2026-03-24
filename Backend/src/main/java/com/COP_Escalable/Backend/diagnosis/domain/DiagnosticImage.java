package com.COP_Escalable.Backend.diagnosis.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.UUID;

@Document("diagnostic_images")
public class DiagnosticImage {

	public enum Status { UPLOADED, ANALYZING, COMPLETED, FAILED }

	@Id
	private UUID id;

	@Indexed
	private UUID organizationId;

	@Indexed
	private UUID siteId;

	@Indexed
	private UUID patientId;

	private String gridFsFileId;
	private String filename;
	private String contentType;
	private Status status;
	private Instant createdAt;

	protected DiagnosticImage() {}

	public DiagnosticImage(UUID organizationId, UUID siteId, UUID patientId,
						   String gridFsFileId, String filename, String contentType) {
		this.id = UUID.randomUUID();
		this.organizationId = requireNonNull(organizationId, "organizationId");
		this.siteId = siteId;
		this.patientId = requireNonNull(patientId, "patientId");
		this.gridFsFileId = requireNonNull(gridFsFileId, "gridFsFileId");
		this.filename = filename;
		this.contentType = contentType;
		this.status = Status.UPLOADED;
		this.createdAt = Instant.now();
	}

	public void markAnalyzing() { this.status = Status.ANALYZING; }
	public void markCompleted() { this.status = Status.COMPLETED; }
	public void markFailed() { this.status = Status.FAILED; }

	public UUID getId() { return id; }
	public UUID getOrganizationId() { return organizationId; }
	public UUID getSiteId() { return siteId; }
	public UUID getPatientId() { return patientId; }
	public String getGridFsFileId() { return gridFsFileId; }
	public String getFilename() { return filename; }
	public String getContentType() { return contentType; }
	public Status getStatus() { return status; }
	public Instant getCreatedAt() { return createdAt; }

	private static <T> T requireNonNull(T value, String name) {
		if (value == null) throw new IllegalArgumentException(name + " is required");
		return value;
	}
}

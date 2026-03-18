package com.COP_Escalable.Backend.clinical.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Document("clinical_records")
public class ClinicalRecord {
	@Id
	private UUID id;

	@Indexed
	private UUID organizationId;

	@Indexed
	private UUID siteId;

	@Indexed
	private UUID patientId;

	private Instant createdAt;
	private Instant updatedAt;

	private List<Entry> entries = new ArrayList<>();

	protected ClinicalRecord() {}

	public ClinicalRecord(UUID organizationId, UUID siteId, UUID patientId) {
		this.id = UUID.randomUUID();
		this.organizationId = require(organizationId, "organizationId");
		this.siteId = siteId;
		this.patientId = require(patientId, "patientId");
		var now = Instant.now();
		this.createdAt = now;
		this.updatedAt = now;
	}

	public void addEntry(UUID authorUserId, String authorUsername, String type, String note) {
		if (type == null || type.isBlank()) throw new IllegalArgumentException("type is required");
		if (note == null || note.isBlank()) throw new IllegalArgumentException("note is required");
		this.entries.add(new Entry(Instant.now(), authorUserId, authorUsername, type.trim(), note.trim()));
		this.updatedAt = Instant.now();
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

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public List<Entry> getEntries() {
		return List.copyOf(entries);
	}

	public record Entry(
			Instant at,
			UUID authorUserId,
			String authorUsername,
			String type,
			String note
	) {}

	private static UUID require(UUID v, String name) {
		if (v == null) throw new IllegalArgumentException(name + " is required");
		return v;
	}
}


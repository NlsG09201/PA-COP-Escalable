package com.COP_Escalable.Backend.odontogram.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Document("odontograms")
public class Odontogram {
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

	/**
	 * Key: tooth code (FDI, e.g. "11", "36"). Value: arbitrary state payload (e.g. "healthy", "caries", "missing").
	 */
	private Map<String, String> teeth = new HashMap<>();

	protected Odontogram() {}

	public Odontogram(UUID organizationId, UUID siteId, UUID patientId) {
		this.id = UUID.randomUUID();
		this.organizationId = require(organizationId, "organizationId");
		this.siteId = siteId;
		this.patientId = require(patientId, "patientId");
		var now = Instant.now();
		this.createdAt = now;
		this.updatedAt = now;
	}

	public void upsertTooth(String tooth, String state) {
		if (tooth == null || tooth.isBlank()) throw new IllegalArgumentException("tooth is required");
		if (state == null || state.isBlank()) throw new IllegalArgumentException("state is required");
		teeth.put(tooth.trim(), state.trim());
		updatedAt = Instant.now();
	}

	public UUID getId() { return id; }
	public UUID getOrganizationId() { return organizationId; }
	public UUID getSiteId() { return siteId; }
	public UUID getPatientId() { return patientId; }
	public Instant getCreatedAt() { return createdAt; }
	public Instant getUpdatedAt() { return updatedAt; }
	public Map<String, String> getTeeth() { return Map.copyOf(teeth); }

	private static UUID require(UUID v, String name) {
		if (v == null) throw new IllegalArgumentException(name + " is required");
		return v;
	}
}


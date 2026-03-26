package com.COP_Escalable.Backend.tenancy.domain;

import com.COP_Escalable.Backend.shared.persistence.AuditableEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.UUID;

@Document(collection = "professionals")
public class Professional extends AuditableEntity {

	@Field("organization_id")
	private UUID organizationId;

	@Field("default_site_id")
	private UUID defaultSiteId;

	@Field("full_name")
	private String fullName;

	private String specialty;

	private ProfessionalStatus status;

	protected Professional() {}

	public Professional(UUID organizationId, UUID defaultSiteId, String fullName, String specialty) {
		if (organizationId == null) throw new IllegalArgumentException("organizationId is required");
		if (fullName == null || fullName.isBlank()) throw new IllegalArgumentException("fullName is required");
		if (specialty == null || specialty.isBlank()) throw new IllegalArgumentException("specialty is required");
		this.organizationId = organizationId;
		this.defaultSiteId = defaultSiteId;
		this.fullName = fullName.trim();
		this.specialty = specialty.trim();
		this.status = ProfessionalStatus.ACTIVE;
	}

	public UUID getOrganizationId() {
		return organizationId;
	}

	public UUID getDefaultSiteId() {
		return defaultSiteId;
	}

	public String getFullName() {
		return fullName;
	}

	public String getSpecialty() {
		return specialty;
	}

	public ProfessionalStatus getStatus() {
		return status;
	}
}

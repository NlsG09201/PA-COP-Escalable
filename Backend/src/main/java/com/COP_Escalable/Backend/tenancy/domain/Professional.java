package com.COP_Escalable.Backend.tenancy.domain;

import com.COP_Escalable.Backend.shared.persistence.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "professionals")
public class Professional extends AuditableEntity {

	@Column(nullable = false, updatable = false)
	private UUID organizationId;

	@Column
	private UUID defaultSiteId;

	@Column(nullable = false)
	private String fullName;

	@Column(nullable = false)
	private String specialty;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
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


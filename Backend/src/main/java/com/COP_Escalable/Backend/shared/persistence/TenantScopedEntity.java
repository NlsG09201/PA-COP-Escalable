package com.COP_Escalable.Backend.shared.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;

import java.util.UUID;

@MappedSuperclass
public abstract class TenantScopedEntity extends AuditableEntity {
	@Column(nullable = false, updatable = false)
	private UUID organizationId;

	@Column
	private UUID siteId;

	protected void setTenant(UUID organizationId, UUID siteId) {
		if (organizationId == null) {
			throw new IllegalArgumentException("organizationId is required");
		}
		this.organizationId = organizationId;
		this.siteId = siteId;
	}

	public UUID getOrganizationId() {
		return organizationId;
	}

	public UUID getSiteId() {
		return siteId;
	}
}


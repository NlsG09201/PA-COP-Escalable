package com.COP_Escalable.Backend.shared.persistence;

import org.springframework.data.mongodb.core.mapping.Field;

import java.util.UUID;

/**
 * Tenant-scoped MongoDB document (organization + optional site).
 */
public abstract class TenantScopedEntity extends AuditableEntity {

	@Field("organization_id")
	private UUID organizationId;

	@Field("site_id")
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

package com.COP_Escalable.Backend.tenancy.domain;

import com.COP_Escalable.Backend.shared.persistence.AuditableEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.UUID;

@Document(collection = "sites")
public class Site extends AuditableEntity {

	@Field("organization_id")
	private UUID organizationId;

	private String name;
	private String timezone;
	private SiteStatus status;

	protected Site() {}

	public Site(UUID organizationId, String name, String timezone) {
		if (organizationId == null) throw new IllegalArgumentException("organizationId is required");
		if (name == null || name.isBlank()) throw new IllegalArgumentException("name is required");
		if (timezone == null || timezone.isBlank()) throw new IllegalArgumentException("timezone is required");
		this.organizationId = organizationId;
		this.name = name.trim();
		this.timezone = timezone.trim();
		this.status = SiteStatus.ACTIVE;
	}

	public UUID getOrganizationId() {
		return organizationId;
	}

	public String getName() {
		return name;
	}

	public String getTimezone() {
		return timezone;
	}

	public SiteStatus getStatus() {
		return status;
	}
}

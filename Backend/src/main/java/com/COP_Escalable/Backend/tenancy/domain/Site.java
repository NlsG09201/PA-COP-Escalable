package com.COP_Escalable.Backend.tenancy.domain;

import com.COP_Escalable.Backend.shared.persistence.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "sites")
public class Site extends AuditableEntity {

	@Column(nullable = false, updatable = false)
	private UUID organizationId;

	@Column(nullable = false)
	private String name;

	@Column(nullable = false)
	private String timezone;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
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


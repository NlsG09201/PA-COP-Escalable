package com.COP_Escalable.Backend.catalog.domain;

import com.COP_Escalable.Backend.shared.persistence.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "service_categories")
public class ServiceCategory extends AuditableEntity {

	@Column(nullable = false, updatable = false)
	private UUID organizationId;

	@Column(nullable = false)
	private String slug;

	@Column(nullable = false)
	private String name;

	@Column
	private String description;

	@Column(nullable = false)
	private String status;

	@Column(nullable = false)
	private int sortOrder;

	protected ServiceCategory() {}

	public UUID getOrganizationId() {
		return organizationId;
	}

	public String getSlug() {
		return slug;
	}

	public String getName() {
		return name;
	}

	public String getDescription() {
		return description;
	}

	public String getStatus() {
		return status;
	}

	public int getSortOrder() {
		return sortOrder;
	}
}

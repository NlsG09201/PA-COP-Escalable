package com.COP_Escalable.Backend.catalog.domain;

import com.COP_Escalable.Backend.shared.persistence.AuditableEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.UUID;

@Document(collection = "service_categories")
public class ServiceCategory extends AuditableEntity {

	@Field("organization_id")
	private UUID organizationId;

	private String slug;

	private String name;

	private String description;

	private String status;

	@Field("sort_order")
	private int sortOrder;

	protected ServiceCategory() {}

	public static ServiceCategory create(UUID organizationId, String slug, String name, String description, int sortOrder) {
		var c = new ServiceCategory();
		c.organizationId = organizationId;
		c.slug = slug.trim().toLowerCase();
		c.name = name.trim();
		c.description = description;
		c.status = "ACTIVE";
		c.sortOrder = sortOrder;
		return c;
	}

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

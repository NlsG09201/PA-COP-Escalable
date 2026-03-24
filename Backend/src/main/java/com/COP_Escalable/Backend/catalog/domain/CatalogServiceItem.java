package com.COP_Escalable.Backend.catalog.domain;

import com.COP_Escalable.Backend.shared.persistence.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "catalog_services")
public class CatalogServiceItem extends AuditableEntity {

	@Column(nullable = false, updatable = false)
	private UUID organizationId;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	@JoinColumn(name = "category_id", nullable = false)
	private ServiceCategory category;

	@Column(nullable = false)
	private String code;

	@Column(nullable = false)
	private String name;

	@Column
	private String description;

	@Column(nullable = false)
	private int defaultDurationMinutes;

	@Column(name = "specialty_match_tokens")
	private String specialtyMatchTokens;

	@Column(nullable = false)
	private boolean active;

	protected CatalogServiceItem() {}

	public UUID getOrganizationId() {
		return organizationId;
	}

	public ServiceCategory getCategory() {
		return category;
	}

	public String getCode() {
		return code;
	}

	public String getName() {
		return name;
	}

	public String getDescription() {
		return description;
	}

	public int getDefaultDurationMinutes() {
		return defaultDurationMinutes;
	}

	public String getSpecialtyMatchTokens() {
		return specialtyMatchTokens;
	}

	public boolean isActive() {
		return active;
	}
}

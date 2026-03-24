package com.COP_Escalable.Backend.catalog.domain;

import com.COP_Escalable.Backend.shared.persistence.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.Locale;
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

	public static CatalogServiceItem create(
			UUID organizationId,
			ServiceCategory category,
			String code,
			String name,
			String description,
			int defaultDurationMinutes,
			String specialtyMatchTokens
	) {
		if (organizationId == null) throw new IllegalArgumentException("organizationId is required");
		if (category == null) throw new IllegalArgumentException("category is required");
		if (code == null || code.isBlank()) throw new IllegalArgumentException("code is required");
		if (name == null || name.isBlank()) throw new IllegalArgumentException("name is required");
		if (defaultDurationMinutes <= 0) throw new IllegalArgumentException("durationMinutes must be > 0");

		var item = new CatalogServiceItem();
		item.organizationId = organizationId;
		item.category = category;
		item.code = code.trim().toLowerCase(Locale.ROOT);
		item.name = name.trim();
		item.description = description == null || description.isBlank() ? null : description.trim();
		item.defaultDurationMinutes = defaultDurationMinutes;
		item.specialtyMatchTokens = specialtyMatchTokens == null || specialtyMatchTokens.isBlank()
				? null
				: specialtyMatchTokens.trim().toLowerCase(Locale.ROOT);
		item.active = true;
		return item;
	}

	public void update(
			ServiceCategory category,
			String name,
			String description,
			int defaultDurationMinutes,
			String specialtyMatchTokens
	) {
		if (category == null) throw new IllegalArgumentException("category is required");
		if (name == null || name.isBlank()) throw new IllegalArgumentException("name is required");
		if (defaultDurationMinutes <= 0) throw new IllegalArgumentException("durationMinutes must be > 0");
		this.category = category;
		this.name = name.trim();
		this.description = description == null || description.isBlank() ? null : description.trim();
		this.defaultDurationMinutes = defaultDurationMinutes;
		this.specialtyMatchTokens = specialtyMatchTokens == null || specialtyMatchTokens.isBlank()
				? null
				: specialtyMatchTokens.trim().toLowerCase(Locale.ROOT);
	}

	public void activate() {
		this.active = true;
	}

	public void deactivate() {
		this.active = false;
	}

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

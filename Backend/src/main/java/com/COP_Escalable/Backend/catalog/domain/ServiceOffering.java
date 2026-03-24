package com.COP_Escalable.Backend.catalog.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "service_offerings")
public class ServiceOffering extends TenantScopedEntity {

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	@JoinColumn(name = "catalog_service_id", nullable = false)
	private CatalogServiceItem catalogService;

	@Column(nullable = false)
	private String publicTitle;

	@Column
	private String publicDescription;

	@Column
	private Integer durationOverrideMinutes;

	@Column(nullable = false)
	private long basePrice;

	@Column
	private Long promoPrice;

	@Column(nullable = false)
	private String currency;

	@Column
	private String badge;

	@Column
	private String features;

	@Column(nullable = false)
	private boolean visiblePublic;

	@Column(nullable = false)
	private boolean active;

	protected ServiceOffering() {}

	public static ServiceOffering create(
			java.util.UUID organizationId,
			java.util.UUID siteId,
			CatalogServiceItem catalogService,
			String publicTitle,
			String publicDescription,
			Integer durationOverrideMinutes,
			long basePrice,
			Long promoPrice,
			String currency,
			String badge,
			String features
	) {
		if (catalogService == null) throw new IllegalArgumentException("catalogService is required");
		if (publicTitle == null || publicTitle.isBlank()) throw new IllegalArgumentException("title is required");
		if (basePrice < 0) throw new IllegalArgumentException("price must be >= 0");
		if (durationOverrideMinutes != null && durationOverrideMinutes <= 0) {
			throw new IllegalArgumentException("duration must be > 0 when provided");
		}
		if (promoPrice != null && promoPrice < 0) throw new IllegalArgumentException("promoPrice must be >= 0");

		var offering = new ServiceOffering();
		offering.setTenant(organizationId, siteId);
		offering.catalogService = catalogService;
		offering.publicTitle = publicTitle.trim();
		offering.publicDescription = publicDescription == null || publicDescription.isBlank() ? null : publicDescription.trim();
		offering.durationOverrideMinutes = durationOverrideMinutes;
		offering.basePrice = basePrice;
		offering.promoPrice = promoPrice;
		offering.currency = (currency == null || currency.isBlank()) ? "COP" : currency.trim().toUpperCase(java.util.Locale.ROOT);
		offering.badge = badge == null || badge.isBlank() ? null : badge.trim();
		offering.features = features == null || features.isBlank() ? null : features.trim();
		offering.visiblePublic = true;
		offering.active = true;
		return offering;
	}

	public void update(
			CatalogServiceItem catalogService,
			String publicTitle,
			String publicDescription,
			Integer durationOverrideMinutes,
			long basePrice,
			Long promoPrice
	) {
		if (catalogService == null) throw new IllegalArgumentException("catalogService is required");
		if (publicTitle == null || publicTitle.isBlank()) throw new IllegalArgumentException("title is required");
		if (basePrice < 0) throw new IllegalArgumentException("price must be >= 0");
		if (durationOverrideMinutes != null && durationOverrideMinutes <= 0) {
			throw new IllegalArgumentException("duration must be > 0 when provided");
		}
		if (promoPrice != null && promoPrice < 0) throw new IllegalArgumentException("promoPrice must be >= 0");
		this.catalogService = catalogService;
		this.publicTitle = publicTitle.trim();
		this.publicDescription = publicDescription == null || publicDescription.isBlank() ? null : publicDescription.trim();
		this.durationOverrideMinutes = durationOverrideMinutes;
		this.basePrice = basePrice;
		this.promoPrice = promoPrice;
	}

	public void setActive(boolean active) {
		this.active = active;
	}

	public CatalogServiceItem getCatalogService() {
		return catalogService;
	}

	public String getPublicTitle() {
		return publicTitle;
	}

	public String getPublicDescription() {
		return publicDescription;
	}

	public Integer getDurationOverrideMinutes() {
		return durationOverrideMinutes;
	}

	public long getBasePrice() {
		return basePrice;
	}

	public Long getPromoPrice() {
		return promoPrice;
	}

	public String getCurrency() {
		return currency;
	}

	public String getBadge() {
		return badge;
	}

	public String getFeatures() {
		return features;
	}

	public boolean isVisiblePublic() {
		return visiblePublic;
	}

	public boolean isActive() {
		return active;
	}
}

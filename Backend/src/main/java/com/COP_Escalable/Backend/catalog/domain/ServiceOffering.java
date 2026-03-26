package com.COP_Escalable.Backend.catalog.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.Locale;
import java.util.UUID;

@Document(collection = "service_offerings")
public class ServiceOffering extends TenantScopedEntity {

	@Field("catalog_service_id")
	private UUID catalogServiceId;

	@Field("public_title")
	private String publicTitle;

	@Field("public_description")
	private String publicDescription;

	@Field("duration_override_minutes")
	private Integer durationOverrideMinutes;

	@Field("base_price")
	private long basePrice;

	@Field("promo_price")
	private Long promoPrice;

	private String currency;

	private String badge;

	private String features;

	@Field("visible_public")
	private boolean visiblePublic;

	private boolean active;

	protected ServiceOffering() {}

	public static ServiceOffering create(
			UUID organizationId,
			UUID siteId,
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
		offering.catalogServiceId = catalogService.getId();
		offering.publicTitle = publicTitle.trim();
		offering.publicDescription = publicDescription == null || publicDescription.isBlank() ? null : publicDescription.trim();
		offering.durationOverrideMinutes = durationOverrideMinutes;
		offering.basePrice = basePrice;
		offering.promoPrice = promoPrice;
		offering.currency = (currency == null || currency.isBlank()) ? "COP" : currency.trim().toUpperCase(Locale.ROOT);
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
		this.catalogServiceId = catalogService.getId();
		this.publicTitle = publicTitle.trim();
		this.publicDescription = publicDescription == null || publicDescription.isBlank() ? null : publicDescription.trim();
		this.durationOverrideMinutes = durationOverrideMinutes;
		this.basePrice = basePrice;
		this.promoPrice = promoPrice;
	}

	public void setActive(boolean active) {
		this.active = active;
	}

	public UUID getCatalogServiceId() {
		return catalogServiceId;
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

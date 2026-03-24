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

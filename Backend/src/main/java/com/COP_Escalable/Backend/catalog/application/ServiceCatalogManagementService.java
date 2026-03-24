package com.COP_Escalable.Backend.catalog.application;

import com.COP_Escalable.Backend.catalog.domain.CatalogServiceItem;
import com.COP_Escalable.Backend.catalog.domain.ServiceOffering;
import com.COP_Escalable.Backend.catalog.infrastructure.CatalogServiceItemRepository;
import com.COP_Escalable.Backend.catalog.infrastructure.ServiceCategoryRepository;
import com.COP_Escalable.Backend.catalog.infrastructure.ServiceOfferingRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class ServiceCatalogManagementService {
	private final ServiceOfferingRepository offerings;
	private final CatalogServiceItemRepository catalogServices;
	private final ServiceCategoryRepository categories;

	public ServiceCatalogManagementService(
			ServiceOfferingRepository offerings,
			CatalogServiceItemRepository catalogServices,
			ServiceCategoryRepository categories
	) {
		this.offerings = offerings;
		this.catalogServices = catalogServices;
		this.categories = categories;
	}

	@Transactional(readOnly = true)
	public List<ManagedServiceView> list(ServiceCatalogCategory category, Boolean active, String query) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) {
			throw new IllegalArgumentException("site_id is required in tenant context");
		}
		String search = (query == null || query.isBlank()) ? null : query.trim();
		String categorySlug = category == null ? null : category.slug();
		return offerings.searchForManagement(tenant.organizationId(), tenant.siteId(), active, categorySlug, search)
				.stream()
				.map(ServiceCatalogManagementService::toView)
				.toList();
	}

	@Transactional
	public ManagedServiceView create(CreateServiceCommand command) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) {
			throw new IllegalArgumentException("site_id is required in tenant context");
		}
		validatePrice(command.price());

		var category = categories.findByOrganizationIdAndSlug(tenant.organizationId(), command.category().slug())
				.orElseThrow(() -> new IllegalArgumentException("Category not configured for organization"));

		ensureNameUnique(tenant.organizationId(), category.getId(), command.name(), null);
		var code = buildCode(command.category(), command.name());
		var catalogItem = CatalogServiceItem.create(
				tenant.organizationId(),
				category,
				code,
				command.name(),
				command.description(),
				resolveDuration(command.duration()),
				command.category().name().toLowerCase(Locale.ROOT)
		);
		var savedItem = catalogServices.save(catalogItem);

		var offering = ServiceOffering.create(
				tenant.organizationId(),
				tenant.siteId(),
				savedItem,
				command.name(),
				command.description(),
				command.duration(),
				command.price(),
				null,
				"COP",
				null,
				null
		);
		var savedOffering = offerings.save(offering);
		return toView(savedOffering);
	}

	@Transactional
	public ManagedServiceView update(UUID serviceId, UpdateServiceCommand command) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) {
			throw new IllegalArgumentException("site_id is required in tenant context");
		}
		validatePrice(command.price());
		var offering = offerings.findByIdForManagement(serviceId, tenant.organizationId(), tenant.siteId())
				.orElseThrow(() -> new IllegalArgumentException("Service not found"));

		var category = categories.findByOrganizationIdAndSlug(tenant.organizationId(), command.category().slug())
				.orElseThrow(() -> new IllegalArgumentException("Category not configured for organization"));
		var catalog = catalogServices.findByIdAndOrganizationId(offering.getCatalogService().getId(), tenant.organizationId())
				.orElseThrow(() -> new IllegalArgumentException("Catalog service not found"));

		ensureNameUnique(tenant.organizationId(), category.getId(), command.name(), catalog.getId());
		catalog.update(
				category,
				command.name(),
				command.description(),
				resolveDuration(command.duration()),
				command.category().name().toLowerCase(Locale.ROOT)
		);
		catalogServices.save(catalog);

		offering.update(
				catalog,
				command.name(),
				command.description(),
				command.duration(),
				command.price(),
				null
		);
		return toView(offerings.save(offering));
	}

	@Transactional
	public ManagedServiceView setActive(UUID serviceId, boolean active) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) {
			throw new IllegalArgumentException("site_id is required in tenant context");
		}
		var offering = offerings.findByIdForManagement(serviceId, tenant.organizationId(), tenant.siteId())
				.orElseThrow(() -> new IllegalArgumentException("Service not found"));
		offering.setActive(active);
		var catalog = offering.getCatalogService();
		if (active) {
			catalog.activate();
		} else {
			catalog.deactivate();
		}
		catalogServices.save(catalog);
		return toView(offerings.save(offering));
	}

	@Transactional
	public void delete(UUID serviceId) {
		setActive(serviceId, false);
	}

	private void ensureNameUnique(UUID orgId, UUID categoryId, String name, UUID excludeId) {
		if (catalogServices.existsByCategoryAndName(orgId, categoryId, name.trim(), excludeId)) {
			throw new IllegalArgumentException("Service name must be unique by category");
		}
	}

	private static int resolveDuration(Integer duration) {
		return duration == null ? 45 : duration;
	}

	private static void validatePrice(long price) {
		if (price < 0) {
			throw new IllegalArgumentException("price must be >= 0");
		}
	}

	private static String buildCode(ServiceCatalogCategory category, String name) {
		String normalized = name.trim().toLowerCase(Locale.ROOT)
				.replaceAll("[^a-z0-9]+", "-")
				.replaceAll("^-+|-+$", "");
		return category.name().toLowerCase(Locale.ROOT) + "-" + normalized;
	}

	private static ManagedServiceView toView(ServiceOffering offering) {
		var catalog = offering.getCatalogService();
		var slug = catalog.getCategory().getSlug();
		var category = "psicologia".equalsIgnoreCase(slug)
				? ServiceCatalogCategory.PSICOLOGIA
				: ServiceCatalogCategory.ODONTOLOGIA;
		int duration = offering.getDurationOverrideMinutes() != null
				? offering.getDurationOverrideMinutes()
				: catalog.getDefaultDurationMinutes();
		String description = offering.getPublicDescription() == null || offering.getPublicDescription().isBlank()
				? catalog.getDescription()
				: offering.getPublicDescription();
		return new ManagedServiceView(
				offering.getId(),
				offering.getPublicTitle(),
				description,
				category,
				offering.getBasePrice(),
				duration,
				offering.isActive() && catalog.isActive(),
				offering.getCreatedAt()
		);
	}

	public record CreateServiceCommand(
			String name,
			String description,
			ServiceCatalogCategory category,
			long price,
			Integer duration
	) {}

	public record UpdateServiceCommand(
			String name,
			String description,
			ServiceCatalogCategory category,
			long price,
			Integer duration
	) {}
}

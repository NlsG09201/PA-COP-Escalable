package com.COP_Escalable.Backend.catalog.application;

import com.COP_Escalable.Backend.catalog.domain.CatalogServiceItem;
import com.COP_Escalable.Backend.catalog.domain.ServiceCategory;
import com.COP_Escalable.Backend.catalog.domain.ServiceOffering;
import com.COP_Escalable.Backend.catalog.infrastructure.CatalogServiceItemRepository;
import com.COP_Escalable.Backend.catalog.infrastructure.ServiceCategoryRepository;
import com.COP_Escalable.Backend.catalog.infrastructure.ServiceOfferingRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
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
		String search = (query == null || query.isBlank()) ? "" : query.trim().toLowerCase(Locale.ROOT);
		String categorySlug = category == null ? null : category.slug();

		var all = offerings.findByOrganizationIdAndSiteIdOrderByPublicTitleAsc(tenant.organizationId(), tenant.siteId());
		return all.stream()
				.filter(o -> active == null || o.isActive() == active)
				.filter(o -> matchesSearch(o, tenant.organizationId(), search, categorySlug))
				.sorted(Comparator.comparing(ServiceOffering::getPublicTitle))
				.map(this::toView)
				.toList();
	}

	private boolean matchesSearch(ServiceOffering o, UUID orgId, String q, String categorySlug) {
		var catalog = catalogServices.findByIdAndOrganizationId(o.getCatalogServiceId(), orgId).orElse(null);
		if (catalog == null || !catalog.isActive()) {
			return false;
		}
		var cat = categories.findById(catalog.getCategoryId()).orElse(null);
		if (cat == null) {
			return false;
		}
		if (categorySlug != null && !categorySlug.equalsIgnoreCase(cat.getSlug())) {
			return false;
		}
		if (q.isEmpty()) {
			return true;
		}
		String title = o.getPublicTitle() == null ? "" : o.getPublicTitle().toLowerCase(Locale.ROOT);
		String cname = catalog.getName() == null ? "" : catalog.getName().toLowerCase(Locale.ROOT);
		String desc = o.getPublicDescription() == null ? "" : o.getPublicDescription().toLowerCase(Locale.ROOT);
		return title.contains(q) || cname.contains(q) || desc.contains(q);
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
		var offering = offerings.findByIdAndOrganizationIdAndSiteId(serviceId, tenant.organizationId(), tenant.siteId())
				.orElseThrow(() -> new IllegalArgumentException("Service not found"));

		var category = categories.findByOrganizationIdAndSlug(tenant.organizationId(), command.category().slug())
				.orElseThrow(() -> new IllegalArgumentException("Category not configured for organization"));
		var catalog = catalogServices.findByIdAndOrganizationId(offering.getCatalogServiceId(), tenant.organizationId())
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
		var offering = offerings.findByIdAndOrganizationIdAndSiteId(serviceId, tenant.organizationId(), tenant.siteId())
				.orElseThrow(() -> new IllegalArgumentException("Service not found"));
		offering.setActive(active);
		var catalog = catalogServices.findByIdAndOrganizationId(offering.getCatalogServiceId(), tenant.organizationId())
				.orElseThrow(() -> new IllegalArgumentException("Catalog service not found"));
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
		var existing = catalogServices.findByOrganizationIdAndCategoryIdAndNameIgnoreCase(orgId, categoryId, name.trim());
		if (existing.isPresent() && (excludeId == null || !existing.get().getId().equals(excludeId))) {
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

	private ManagedServiceView toView(ServiceOffering offering) {
		var catalog = catalogServices.findById(offering.getCatalogServiceId()).orElseThrow();
		var cat = categories.findById(catalog.getCategoryId()).orElseThrow();
		var slug = cat.getSlug();
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

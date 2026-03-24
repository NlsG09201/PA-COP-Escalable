package com.COP_Escalable.Backend.catalog.application;

import com.COP_Escalable.Backend.catalog.domain.ServiceOffering;
import com.COP_Escalable.Backend.catalog.infrastructure.ProfessionalServiceAssignmentRepository;
import com.COP_Escalable.Backend.catalog.infrastructure.ServiceOfferingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Service
public class PublishedCatalogService {
	private final ServiceOfferingRepository offerings;
	private final ProfessionalServiceAssignmentRepository assignments;

	public PublishedCatalogService(ServiceOfferingRepository offerings, ProfessionalServiceAssignmentRepository assignments) {
		this.offerings = offerings;
		this.assignments = assignments;
	}

	@Transactional(readOnly = true)
	public List<PublishedOfferingView> listPublishedForSite(UUID organizationId, UUID siteId) {
		return offerings.findAllPublishedForSite(organizationId, siteId).stream()
				.map(PublishedCatalogService::toView)
				.toList();
	}

	@Transactional(readOnly = true)
	public PublishedOfferingView requirePublished(UUID organizationId, UUID siteId, String offeringIdRaw) {
		UUID offeringId;
		try {
			offeringId = UUID.fromString(offeringIdRaw == null ? "" : offeringIdRaw.trim());
		} catch (IllegalArgumentException ex) {
			throw new IllegalArgumentException("Service not found");
		}
		var entity = offerings.findPublishedById(offeringId, organizationId, siteId)
				.orElseThrow(() -> new IllegalArgumentException("Service not found"));
		return toView(entity);
	}

	@Transactional(readOnly = true)
	public List<UUID> explicitProfessionalIds(UUID organizationId, UUID siteId, UUID offeringId) {
		return assignments.findProfessionalIdsForOffering(offeringId, organizationId, siteId);
	}

	private static PublishedOfferingView toView(ServiceOffering o) {
		var cs = o.getCatalogService();
		var cat = cs.getCategory();
		int duration = o.getDurationOverrideMinutes() != null ? o.getDurationOverrideMinutes() : cs.getDefaultDurationMinutes();
		String desc = o.getPublicDescription() != null && !o.getPublicDescription().isBlank()
				? o.getPublicDescription()
				: (cs.getDescription() == null ? "" : cs.getDescription());
		return new PublishedOfferingView(
				o.getId(),
				cat.getName(),
				o.getPublicTitle(),
				desc,
				duration,
				o.getBasePrice(),
				o.getPromoPrice(),
				o.getBadge(),
				splitPipeList(o.getFeatures()),
				splitCommaTokens(cs.getSpecialtyMatchTokens())
		);
	}

	private static List<String> splitPipeList(String raw) {
		if (raw == null || raw.isBlank()) {
			return List.of();
		}
		return Arrays.stream(raw.split("\\|"))
				.map(String::trim)
				.filter(s -> !s.isEmpty())
				.toList();
	}

	private static List<String> splitCommaTokens(String raw) {
		if (raw == null || raw.isBlank()) {
			return List.of();
		}
		return Arrays.stream(raw.split(","))
				.map(String::trim)
				.map(s -> s.toLowerCase(java.util.Locale.ROOT))
				.filter(s -> !s.isEmpty())
				.toList();
	}
}

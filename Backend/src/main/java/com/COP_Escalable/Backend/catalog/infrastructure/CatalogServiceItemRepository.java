package com.COP_Escalable.Backend.catalog.infrastructure;

import com.COP_Escalable.Backend.catalog.domain.CatalogServiceItem;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;
import java.util.UUID;

public interface CatalogServiceItemRepository extends MongoRepository<CatalogServiceItem, UUID> {
	Optional<CatalogServiceItem> findByIdAndOrganizationId(UUID id, UUID organizationId);

	Optional<CatalogServiceItem> findByOrganizationIdAndCategoryIdAndNameIgnoreCase(
			UUID organizationId, UUID categoryId, String name);
}

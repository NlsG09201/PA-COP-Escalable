package com.COP_Escalable.Backend.catalog.infrastructure;

import com.COP_Escalable.Backend.catalog.domain.ServiceCategory;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;
import java.util.UUID;

public interface ServiceCategoryRepository extends MongoRepository<ServiceCategory, UUID> {
	Optional<ServiceCategory> findByOrganizationIdAndSlug(UUID organizationId, String slug);

	boolean existsByOrganizationId(UUID organizationId);
}

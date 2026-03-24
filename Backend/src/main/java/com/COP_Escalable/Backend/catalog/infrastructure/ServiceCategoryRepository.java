package com.COP_Escalable.Backend.catalog.infrastructure;

import com.COP_Escalable.Backend.catalog.domain.ServiceCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ServiceCategoryRepository extends JpaRepository<ServiceCategory, UUID> {
	Optional<ServiceCategory> findByOrganizationIdAndSlug(UUID organizationId, String slug);
}

package com.COP_Escalable.Backend.catalog.infrastructure;

import com.COP_Escalable.Backend.catalog.domain.ServiceOffering;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ServiceOfferingRepository extends MongoRepository<ServiceOffering, UUID> {

	Optional<ServiceOffering> findByIdAndOrganizationIdAndSiteId(UUID id, UUID organizationId, UUID siteId);

	List<ServiceOffering> findByOrganizationIdAndSiteIdOrderByPublicTitleAsc(UUID organizationId, UUID siteId);
}

package com.COP_Escalable.Backend.tenancy.infrastructure;

import com.COP_Escalable.Backend.tenancy.domain.Site;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SiteRepository extends MongoRepository<Site, UUID> {
	List<Site> findAllByOrganizationId(UUID organizationId);
	Optional<Site> findByIdAndOrganizationId(UUID id, UUID organizationId);
}

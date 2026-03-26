package com.COP_Escalable.Backend.tenancy.infrastructure;

import com.COP_Escalable.Backend.tenancy.domain.Professional;
import com.COP_Escalable.Backend.tenancy.domain.ProfessionalStatus;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProfessionalRepository extends MongoRepository<Professional, UUID> {
	List<Professional> findAllByOrganizationId(UUID organizationId);
	List<Professional> findAllByOrganizationIdAndStatus(UUID organizationId, ProfessionalStatus status);
	List<Professional> findAllByOrganizationIdAndDefaultSiteIdAndStatus(UUID organizationId, UUID defaultSiteId, ProfessionalStatus status);
	List<Professional> findAllByOrganizationIdAndIdIn(UUID organizationId, Collection<UUID> ids);
	Optional<Professional> findByIdAndOrganizationId(UUID id, UUID organizationId);
}

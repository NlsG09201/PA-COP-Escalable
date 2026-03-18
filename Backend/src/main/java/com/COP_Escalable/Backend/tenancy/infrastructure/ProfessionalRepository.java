package com.COP_Escalable.Backend.tenancy.infrastructure;

import com.COP_Escalable.Backend.tenancy.domain.Professional;
import com.COP_Escalable.Backend.tenancy.domain.ProfessionalStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProfessionalRepository extends JpaRepository<Professional, UUID> {
	List<Professional> findAllByOrganizationId(UUID organizationId);
	List<Professional> findAllByOrganizationIdAndStatus(UUID organizationId, ProfessionalStatus status);
	List<Professional> findAllByOrganizationIdAndDefaultSiteIdAndStatus(UUID organizationId, UUID defaultSiteId, ProfessionalStatus status);
	Optional<Professional> findByIdAndOrganizationId(UUID id, UUID organizationId);
}


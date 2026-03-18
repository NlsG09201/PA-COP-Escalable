package com.COP_Escalable.Backend.tenancy.infrastructure;

import com.COP_Escalable.Backend.tenancy.domain.Professional;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProfessionalRepository extends JpaRepository<Professional, UUID> {
	List<Professional> findAllByOrganizationId(UUID organizationId);
	Optional<Professional> findByIdAndOrganizationId(UUID id, UUID organizationId);
}


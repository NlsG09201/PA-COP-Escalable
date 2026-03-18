package com.COP_Escalable.Backend.tenancy.infrastructure;

import com.COP_Escalable.Backend.tenancy.domain.Site;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SiteRepository extends JpaRepository<Site, UUID> {
	List<Site> findAllByOrganizationId(UUID organizationId);
	Optional<Site> findByIdAndOrganizationId(UUID id, UUID organizationId);
}


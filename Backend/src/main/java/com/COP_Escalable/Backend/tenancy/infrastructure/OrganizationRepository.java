package com.COP_Escalable.Backend.tenancy.infrastructure;

import com.COP_Escalable.Backend.tenancy.domain.Organization;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface OrganizationRepository extends JpaRepository<Organization, UUID> {
}


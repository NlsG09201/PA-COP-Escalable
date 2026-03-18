package com.COP_Escalable.Backend.patients.infrastructure;

import com.COP_Escalable.Backend.patients.domain.Patient;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PatientRepository extends JpaRepository<Patient, UUID> {
	List<Patient> findAllByOrganizationIdAndSiteId(UUID organizationId, UUID siteId);
	Optional<Patient> findByIdAndOrganizationId(UUID id, UUID organizationId);
	Optional<Patient> findByIdAndOrganizationIdAndSiteId(UUID id, UUID organizationId, UUID siteId);
}


package com.COP_Escalable.Backend.patients.infrastructure;

import com.COP_Escalable.Backend.patients.domain.Patient;
import com.COP_Escalable.Backend.patients.domain.PatientStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PatientRepository extends JpaRepository<Patient, UUID> {
	long countByOrganizationIdAndSiteIdAndStatus(UUID organizationId, UUID siteId, PatientStatus status);

	List<Patient> findAllByOrganizationIdAndSiteId(UUID organizationId, UUID siteId);
	Optional<Patient> findByIdAndOrganizationId(UUID id, UUID organizationId);
	Optional<Patient> findByIdAndOrganizationIdAndSiteId(UUID id, UUID organizationId, UUID siteId);
	Optional<Patient> findFirstByOrganizationIdAndSiteIdAndEmailIgnoreCase(UUID organizationId, UUID siteId, String email);
	Optional<Patient> findFirstByOrganizationIdAndSiteIdAndPhone(UUID organizationId, UUID siteId, String phone);
}


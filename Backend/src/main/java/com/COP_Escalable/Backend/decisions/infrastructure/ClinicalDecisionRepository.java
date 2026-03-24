package com.COP_Escalable.Backend.decisions.infrastructure;

import com.COP_Escalable.Backend.decisions.domain.ClinicalDecision;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ClinicalDecisionRepository extends JpaRepository<ClinicalDecision, UUID> {

	List<ClinicalDecision> findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
			UUID organizationId, UUID siteId, UUID patientId);

	List<ClinicalDecision> findByOrganizationIdAndSiteIdOrderByCreatedAtDesc(
			UUID organizationId, UUID siteId);

	long countByOrganizationIdAndSiteIdAndAccepted(UUID organizationId, UUID siteId, Boolean accepted);
}

package com.COP_Escalable.Backend.decisions.infrastructure;

import com.COP_Escalable.Backend.decisions.domain.ClinicalDecision;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.UUID;

public interface ClinicalDecisionRepository extends MongoRepository<ClinicalDecision, UUID> {

	List<ClinicalDecision> findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
			UUID organizationId, UUID siteId, UUID patientId);

	List<ClinicalDecision> findByOrganizationIdAndSiteIdOrderByCreatedAtDesc(
			UUID organizationId, UUID siteId);

	long countByOrganizationIdAndSiteIdAndAccepted(UUID organizationId, UUID siteId, Boolean accepted);
}

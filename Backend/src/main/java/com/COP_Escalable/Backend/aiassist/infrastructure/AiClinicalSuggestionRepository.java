package com.COP_Escalable.Backend.aiassist.infrastructure;

import com.COP_Escalable.Backend.aiassist.domain.AiClinicalSuggestion;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;
import java.util.UUID;

public interface AiClinicalSuggestionRepository extends MongoRepository<AiClinicalSuggestion, UUID> {

	Optional<AiClinicalSuggestion> findTopByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
			UUID organizationId,
			UUID siteId,
			UUID patientId
	);

	Optional<AiClinicalSuggestion> findByIdAndOrganizationIdAndSiteId(UUID id, UUID organizationId, UUID siteId);
}

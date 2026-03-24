package com.COP_Escalable.Backend.personalization.infrastructure;

import com.COP_Escalable.Backend.personalization.domain.PatientPreferenceProfile;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;
import java.util.UUID;

public interface PatientPreferenceProfileRepository extends MongoRepository<PatientPreferenceProfile, UUID> {

	Optional<PatientPreferenceProfile> findByOrganizationIdAndSiteIdAndPatientId(
			UUID organizationId, UUID siteId, UUID patientId);
}

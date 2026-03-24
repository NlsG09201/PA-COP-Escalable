package com.COP_Escalable.Backend.diagnosis.infrastructure;

import com.COP_Escalable.Backend.diagnosis.domain.DiagnosisResult;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DiagnosisResultRepository extends MongoRepository<DiagnosisResult, UUID> {

	List<DiagnosisResult> findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
			UUID organizationId, UUID siteId, UUID patientId);

	Optional<DiagnosisResult> findByImageId(UUID imageId);
}

package com.COP_Escalable.Backend.clinical.infrastructure;

import com.COP_Escalable.Backend.clinical.domain.ClinicalRecord;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;
import java.util.UUID;

public interface ClinicalRecordRepository extends MongoRepository<ClinicalRecord, UUID> {
	Optional<ClinicalRecord> findTopByOrganizationIdAndSiteIdAndPatientIdOrderByUpdatedAtDesc(UUID organizationId, UUID siteId, UUID patientId);
}


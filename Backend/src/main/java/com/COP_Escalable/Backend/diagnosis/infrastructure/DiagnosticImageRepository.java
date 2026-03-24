package com.COP_Escalable.Backend.diagnosis.infrastructure;

import com.COP_Escalable.Backend.diagnosis.domain.DiagnosticImage;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.UUID;

public interface DiagnosticImageRepository extends MongoRepository<DiagnosticImage, UUID> {

	List<DiagnosticImage> findByOrganizationIdAndSiteIdAndPatientId(UUID organizationId, UUID siteId, UUID patientId);
}

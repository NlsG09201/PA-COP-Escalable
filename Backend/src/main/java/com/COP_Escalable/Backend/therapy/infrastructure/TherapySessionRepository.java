package com.COP_Escalable.Backend.therapy.infrastructure;

import com.COP_Escalable.Backend.therapy.domain.TherapySession;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface TherapySessionRepository extends MongoRepository<TherapySession, UUID> {

	List<TherapySession> findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
			UUID organizationId, UUID siteId, UUID patientId);

	long countByOrganizationIdAndSiteIdAndPatientIdAndCreatedAtAfter(
			UUID organizationId, UUID siteId, UUID patientId, Instant after);
}

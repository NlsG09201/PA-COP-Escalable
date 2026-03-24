package com.COP_Escalable.Backend.therapy.infrastructure;

import com.COP_Escalable.Backend.therapy.domain.TherapySession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface TherapySessionRepository extends JpaRepository<TherapySession, UUID> {

	List<TherapySession> findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
			UUID organizationId, UUID siteId, UUID patientId);

	long countByPatientIdAndCreatedAtAfter(UUID patientId, Instant after);

	List<TherapySession> findByPatientIdAndStatus(UUID patientId, String status);
}

package com.COP_Escalable.Backend.copilot.infrastructure;

import com.COP_Escalable.Backend.copilot.domain.CopilotSession;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.UUID;

public interface CopilotSessionRepository extends MongoRepository<CopilotSession, UUID> {

	List<CopilotSession> findByOrganizationIdAndSiteIdAndPatientIdOrderByStartedAtDesc(
			UUID organizationId, UUID siteId, UUID patientId);

	List<CopilotSession> findByProfessionalIdAndStatus(UUID professionalId, String status);
}

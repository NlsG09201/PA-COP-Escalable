package com.COP_Escalable.Backend.experience.infrastructure;

import com.COP_Escalable.Backend.experience.domain.SatisfactionSurvey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface SatisfactionSurveyRepository extends JpaRepository<SatisfactionSurvey, UUID> {

	List<SatisfactionSurvey> findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
			UUID organizationId, UUID siteId, UUID patientId);

	List<SatisfactionSurvey> findByOrganizationIdAndSiteIdAndStatus(
			UUID organizationId, UUID siteId, String status);

	List<SatisfactionSurvey> findByOrganizationIdAndSiteIdAndStatusAndCompletedAtAfter(
			UUID organizationId, UUID siteId, String status, Instant after);

	boolean existsByOrganizationIdAndSiteIdAndPatientIdAndCreatedAtAfter(
			UUID organizationId, UUID siteId, UUID patientId, Instant after);
}

package com.COP_Escalable.Backend.followup.infrastructure;

import com.COP_Escalable.Backend.followup.domain.FollowupSurvey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface FollowupSurveyRepository extends JpaRepository<FollowupSurvey, UUID> {

	List<FollowupSurvey> findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
			UUID organizationId, UUID siteId, UUID patientId);

	List<FollowupSurvey> findByStatusAndScheduledAtBefore(String status, Instant before);
}

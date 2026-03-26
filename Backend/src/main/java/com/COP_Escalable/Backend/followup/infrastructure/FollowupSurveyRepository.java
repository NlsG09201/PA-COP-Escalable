package com.COP_Escalable.Backend.followup.infrastructure;

import com.COP_Escalable.Backend.followup.domain.FollowupSurvey;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface FollowupSurveyRepository extends MongoRepository<FollowupSurvey, UUID> {

	List<FollowupSurvey> findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
			UUID organizationId, UUID siteId, UUID patientId);

	List<FollowupSurvey> findByStatusAndScheduledAtBefore(String status, Instant before);
}

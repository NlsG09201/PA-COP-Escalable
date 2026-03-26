package com.COP_Escalable.Backend.followup.infrastructure;

import com.COP_Escalable.Backend.followup.domain.FollowupSchedule;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface FollowupScheduleRepository extends MongoRepository<FollowupSchedule, UUID> {

	List<FollowupSchedule> findByOrganizationIdAndSiteIdAndPatientId(
			UUID organizationId, UUID siteId, UUID patientId);

	List<FollowupSchedule> findByStatusAndScheduledDateBefore(String status, LocalDate date);
}

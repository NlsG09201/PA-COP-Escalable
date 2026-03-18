package com.COP_Escalable.Backend.psychtests.infrastructure;

import com.COP_Escalable.Backend.psychtests.domain.TestSubmission;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.UUID;

public interface TestSubmissionRepository extends MongoRepository<TestSubmission, UUID> {
	List<TestSubmission> findAllByOrganizationIdAndSiteIdAndPatientIdOrderBySubmittedAtDesc(UUID organizationId, UUID siteId, UUID patientId);
}


package com.COP_Escalable.Backend.relapse.infrastructure;

import com.COP_Escalable.Backend.relapse.domain.RelapseAlert;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RelapseAlertRepository extends MongoRepository<RelapseAlert, UUID> {

	List<RelapseAlert> findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
			UUID organizationId, UUID siteId, UUID patientId);

	Optional<RelapseAlert> findTopByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
			UUID organizationId, UUID siteId, UUID patientId);
}

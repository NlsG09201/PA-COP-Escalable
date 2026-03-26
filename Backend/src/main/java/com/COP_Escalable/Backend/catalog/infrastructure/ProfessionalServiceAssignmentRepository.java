package com.COP_Escalable.Backend.catalog.infrastructure;

import com.COP_Escalable.Backend.catalog.domain.ProfessionalServiceAssignment;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.UUID;

public interface ProfessionalServiceAssignmentRepository extends MongoRepository<ProfessionalServiceAssignment, UUID> {

	List<ProfessionalServiceAssignment> findByServiceOfferingIdAndOrganizationIdAndSiteIdAndActive(
			UUID serviceOfferingId, UUID organizationId, UUID siteId, boolean active);
}

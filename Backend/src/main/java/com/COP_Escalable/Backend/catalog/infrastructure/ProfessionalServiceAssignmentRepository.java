package com.COP_Escalable.Backend.catalog.infrastructure;

import com.COP_Escalable.Backend.catalog.domain.ProfessionalServiceAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ProfessionalServiceAssignmentRepository extends JpaRepository<ProfessionalServiceAssignment, UUID> {

	@Query("""
			select a.professionalId from ProfessionalServiceAssignment a
			where a.serviceOffering.id = :offeringId
			  and a.organizationId = :orgId and a.siteId = :siteId and a.active = true
			""")
	List<UUID> findProfessionalIdsForOffering(
			@Param("offeringId") UUID offeringId,
			@Param("orgId") UUID orgId,
			@Param("siteId") UUID siteId
	);
}

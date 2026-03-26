package com.COP_Escalable.Backend.budget.infrastructure;

import com.COP_Escalable.Backend.budget.domain.ClinicalBudget;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.UUID;

public interface ClinicalBudgetRepository extends MongoRepository<ClinicalBudget, UUID> {

	List<ClinicalBudget> findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
			UUID organizationId, UUID siteId, UUID patientId);
}

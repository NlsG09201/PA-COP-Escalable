package com.COP_Escalable.Backend.odontology.infrastructure;

import com.COP_Escalable.Backend.odontology.domain.TreatmentPlan;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.UUID;

public interface TreatmentPlanRepository extends MongoRepository<TreatmentPlan, UUID> {
    List<TreatmentPlan> findAllByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
            UUID organizationId, UUID siteId, UUID patientId
    );
}

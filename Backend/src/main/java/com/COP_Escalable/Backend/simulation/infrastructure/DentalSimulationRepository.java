package com.COP_Escalable.Backend.simulation.infrastructure;

import com.COP_Escalable.Backend.simulation.domain.DentalSimulation;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.UUID;

public interface DentalSimulationRepository extends MongoRepository<DentalSimulation, UUID> {

	List<DentalSimulation> findByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
			UUID organizationId, UUID siteId, UUID patientId);
}

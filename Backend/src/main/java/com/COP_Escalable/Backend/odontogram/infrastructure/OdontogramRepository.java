package com.COP_Escalable.Backend.odontogram.infrastructure;

import com.COP_Escalable.Backend.odontogram.domain.Odontogram;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;
import java.util.UUID;

public interface OdontogramRepository extends MongoRepository<Odontogram, UUID> {
	Optional<Odontogram> findByOrganizationIdAndSiteIdAndPatientId(UUID organizationId, UUID siteId, UUID patientId);

	Optional<Odontogram> findTopByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(UUID organizationId, UUID siteId, UUID patientId);
}


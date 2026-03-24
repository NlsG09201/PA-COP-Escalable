package com.COP_Escalable.Backend.experience.infrastructure;

import com.COP_Escalable.Backend.experience.domain.ChurnPrediction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChurnPredictionRepository extends JpaRepository<ChurnPrediction, UUID> {

	Optional<ChurnPrediction> findTopByOrganizationIdAndSiteIdAndPatientIdOrderByCreatedAtDesc(
			UUID organizationId, UUID siteId, UUID patientId);

	List<ChurnPrediction> findByOrganizationIdAndSiteIdOrderByCreatedAtDesc(
			UUID organizationId, UUID siteId);
}

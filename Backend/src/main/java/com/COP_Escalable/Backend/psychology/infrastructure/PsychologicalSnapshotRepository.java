package com.COP_Escalable.Backend.psychology.infrastructure;

import com.COP_Escalable.Backend.psychology.domain.PsychologicalSnapshot;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PsychologicalSnapshotRepository extends MongoRepository<PsychologicalSnapshot, UUID> {
    List<PsychologicalSnapshot> findAllByOrganizationIdAndSiteIdAndPatientIdOrderByOccurredAtDesc(
            UUID organizationId, UUID siteId, UUID patientId
    );

    Optional<PsychologicalSnapshot> findTopByPatientIdOrderByOccurredAtDesc(UUID patientId);
}

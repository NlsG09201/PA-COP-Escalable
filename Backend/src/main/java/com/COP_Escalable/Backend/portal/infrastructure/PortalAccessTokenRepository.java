package com.COP_Escalable.Backend.portal.infrastructure;

import com.COP_Escalable.Backend.portal.domain.PortalAccessToken;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PortalAccessTokenRepository extends MongoRepository<PortalAccessToken, UUID> {

	Optional<PortalAccessToken> findByTokenHashAndActiveTrue(String tokenHash);

	List<PortalAccessToken> findByPatientId(UUID patientId);
}

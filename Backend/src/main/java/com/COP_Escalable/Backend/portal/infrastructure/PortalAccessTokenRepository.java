package com.COP_Escalable.Backend.portal.infrastructure;

import com.COP_Escalable.Backend.portal.domain.PortalAccessToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PortalAccessTokenRepository extends JpaRepository<PortalAccessToken, UUID> {

	Optional<PortalAccessToken> findByTokenHashAndActiveTrue(String tokenHash);

	List<PortalAccessToken> findByPatientId(UUID patientId);
}

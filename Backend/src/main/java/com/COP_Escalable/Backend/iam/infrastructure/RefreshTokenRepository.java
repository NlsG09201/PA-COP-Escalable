package com.COP_Escalable.Backend.iam.infrastructure;

import com.COP_Escalable.Backend.iam.domain.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
	Optional<RefreshToken> findByTokenHash(String tokenHash);
}


package com.COP_Escalable.Backend.iam.infrastructure;

import com.COP_Escalable.Backend.iam.domain.RefreshToken;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends MongoRepository<RefreshToken, UUID> {
	Optional<RefreshToken> findByTokenHash(String tokenHash);
	List<RefreshToken> findByUserIdOrderByIssuedAtDesc(UUID userId);
}

package com.COP_Escalable.Backend.iam.infrastructure;

import com.COP_Escalable.Backend.iam.domain.UserAccount;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserAccountRepository extends MongoRepository<UserAccount, UUID> {
	Optional<UserAccount> findByOrganizationIdAndUsername(UUID organizationId, String username);
	Optional<UserAccount> findByUsername(String username);
}

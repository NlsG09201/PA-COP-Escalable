package com.COP_Escalable.Backend.iam.infrastructure;

import com.COP_Escalable.Backend.iam.domain.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserAccountRepository extends JpaRepository<UserAccount, UUID> {
	Optional<UserAccount> findByOrganizationIdAndUsername(UUID organizationId, String username);
	Optional<UserAccount> findByUsername(String username);
}


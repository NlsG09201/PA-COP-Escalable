package com.COP_Escalable.Backend.iam.service;

import com.COP_Escalable.Backend.iam.domain.UserStatus;
import com.COP_Escalable.Backend.iam.infrastructure.UserAccountRepository;
import com.COP_Escalable.Backend.iam.infrastructure.UserRoleRepository;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PrincipalService {
	private final UserAccountRepository users;
	private final UserRoleRepository roles;

	public PrincipalService(UserAccountRepository users, UserRoleRepository roles) {
		this.users = users;
		this.roles = roles;
	}

	public CopUserPrincipal requireById(UUID userId) {
		var u = users.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
		var roleSet = roles.findAllByUserId(u.getId()).stream().map(r -> r.getRole()).collect(Collectors.toUnmodifiableSet());
		return new CopUserPrincipal(
				u.getId(),
				u.getOrganizationId(),
				u.getUsername(),
				u.getPasswordHash(),
				u.getStatus() == UserStatus.ACTIVE,
				roleSet
		);
	}
}


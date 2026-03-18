package com.COP_Escalable.Backend.iam.service;

import com.COP_Escalable.Backend.iam.domain.UserStatus;
import com.COP_Escalable.Backend.iam.infrastructure.UserAccountRepository;
import com.COP_Escalable.Backend.iam.infrastructure.UserRoleRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.stream.Collectors;

@Service
public class IamUserDetailsService implements UserDetailsService {
	private final UserAccountRepository users;
	private final UserRoleRepository roles;

	public IamUserDetailsService(UserAccountRepository users, UserRoleRepository roles) {
		this.users = users;
		this.roles = roles;
	}

	@Override
	public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
		var u = users.findByUsername(username.trim().toLowerCase())
				.orElseThrow(() -> new UsernameNotFoundException("User not found"));
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


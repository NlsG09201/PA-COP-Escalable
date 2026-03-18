package com.COP_Escalable.Backend.iam.service;

import com.COP_Escalable.Backend.iam.domain.Role;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Set;
import java.util.UUID;

public class CopUserPrincipal implements UserDetails {
	private final UUID userId;
	private final UUID organizationId;
	private final String username;
	private final String passwordHash;
	private final boolean enabled;
	private final Set<Role> roles;

	public CopUserPrincipal(UUID userId, UUID organizationId, String username, String passwordHash, boolean enabled, Set<Role> roles) {
		this.userId = userId;
		this.organizationId = organizationId;
		this.username = username;
		this.passwordHash = passwordHash;
		this.enabled = enabled;
		this.roles = roles;
	}

	public UUID userId() {
		return userId;
	}

	public UUID organizationId() {
		return organizationId;
	}

	public Set<Role> roles() {
		return roles;
	}

	@Override
	public Collection<? extends GrantedAuthority> getAuthorities() {
		return roles.stream().map(r -> new SimpleGrantedAuthority("ROLE_" + r.name())).toList();
	}

	@Override
	public String getPassword() {
		return passwordHash;
	}

	@Override
	public String getUsername() {
		return username;
	}

	@Override
	public boolean isAccountNonExpired() {
		return true;
	}

	@Override
	public boolean isAccountNonLocked() {
		return true;
	}

	@Override
	public boolean isCredentialsNonExpired() {
		return true;
	}

	@Override
	public boolean isEnabled() {
		return enabled;
	}
}


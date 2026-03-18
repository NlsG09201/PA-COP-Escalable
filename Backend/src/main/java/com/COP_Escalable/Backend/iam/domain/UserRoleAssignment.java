package com.COP_Escalable.Backend.iam.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.util.UUID;

@Entity
@Table(name = "user_roles")
@IdClass(UserRoleAssignment.Key.class)
public class UserRoleAssignment {
	@Id
	@Column(nullable = false, updatable = false)
	private UUID userId;

	@Id
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, updatable = false)
	private Role role;

	protected UserRoleAssignment() {}

	public UserRoleAssignment(UUID userId, Role role) {
		if (userId == null) throw new IllegalArgumentException("userId is required");
		if (role == null) throw new IllegalArgumentException("role is required");
		this.userId = userId;
		this.role = role;
	}

	public UUID getUserId() {
		return userId;
	}

	public Role getRole() {
		return role;
	}

	public record Key(UUID userId, Role role) implements Serializable {}
}


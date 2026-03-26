package com.COP_Escalable.Backend.iam.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.UUID;

@Document(collection = "user_roles")
public class UserRoleAssignment {
	@Id
	private String id;

	@Field("user_id")
	private UUID userId;

	private Role role;

	protected UserRoleAssignment() {}

	public UserRoleAssignment(UUID userId, Role role) {
		if (userId == null) throw new IllegalArgumentException("userId is required");
		if (role == null) throw new IllegalArgumentException("role is required");
		this.userId = userId;
		this.role = role;
		this.id = buildId(userId, role);
	}

	public static String buildId(UUID userId, Role role) {
		return userId + ":" + role.name();
	}

	public String getId() {
		return id;
	}

	public UUID getUserId() {
		return userId;
	}

	public Role getRole() {
		return role;
	}

	/** Kept for API compatibility with code referencing Key.class */
	public record Key(UUID userId, Role role) implements java.io.Serializable {}
}

package com.COP_Escalable.Backend.iam.domain;

import com.COP_Escalable.Backend.shared.persistence.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "users")
public class UserAccount extends AuditableEntity {

	@Column(nullable = false, updatable = false)
	private UUID organizationId;

	@Column(nullable = false)
	private String username;

	@Column(nullable = false)
	private String passwordHash;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private UserStatus status;

	protected UserAccount() {}

	public UserAccount(UUID organizationId, String username, String passwordHash) {
		if (organizationId == null) throw new IllegalArgumentException("organizationId is required");
		if (username == null || username.isBlank()) throw new IllegalArgumentException("username is required");
		if (passwordHash == null || passwordHash.isBlank()) throw new IllegalArgumentException("passwordHash is required");
		this.organizationId = organizationId;
		this.username = username.trim().toLowerCase();
		this.passwordHash = passwordHash;
		this.status = UserStatus.ACTIVE;
	}

	public UUID getOrganizationId() {
		return organizationId;
	}

	public String getUsername() {
		return username;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public void setPasswordHash(String passwordHash) {
		if (passwordHash == null || passwordHash.isBlank()) throw new IllegalArgumentException("passwordHash is required");
		this.passwordHash = passwordHash;
	}

	public UserStatus getStatus() {
		return status;
	}
}


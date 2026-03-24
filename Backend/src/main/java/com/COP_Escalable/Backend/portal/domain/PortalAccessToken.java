package com.COP_Escalable.Backend.portal.domain;

import com.COP_Escalable.Backend.shared.persistence.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "portal_access_tokens")
public class PortalAccessToken extends AuditableEntity {

	@Column(nullable = false)
	private UUID patientId;

	@Column(nullable = false, unique = true)
	private String tokenHash;

	@Column(nullable = false)
	private Instant expiresAt;

	private Instant lastUsedAt;

	@Column(nullable = false)
	private boolean active;

	protected PortalAccessToken() {}

	public static PortalAccessToken create(UUID patientId, String tokenHash, Instant expiresAt) {
		var token = new PortalAccessToken();
		token.patientId = patientId;
		token.tokenHash = tokenHash;
		token.expiresAt = expiresAt;
		token.active = true;
		return token;
	}

	public boolean isExpired() {
		return Instant.now().isAfter(expiresAt);
	}

	public void recordUsage() {
		this.lastUsedAt = Instant.now();
	}

	public void revoke() {
		this.active = false;
	}

	public UUID getPatientId() { return patientId; }
	public String getTokenHash() { return tokenHash; }
	public Instant getExpiresAt() { return expiresAt; }
	public Instant getLastUsedAt() { return lastUsedAt; }
	public boolean isActive() { return active; }
}

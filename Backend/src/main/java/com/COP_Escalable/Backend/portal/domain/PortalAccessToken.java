package com.COP_Escalable.Backend.portal.domain;

import com.COP_Escalable.Backend.shared.persistence.AuditableEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.UUID;

@Document(collection = "portal_access_tokens")
public class PortalAccessToken extends AuditableEntity {

	@Field("patient_id")
	private UUID patientId;

	@Field("token_hash")
	private String tokenHash;

	@Field("expires_at")
	private Instant expiresAt;

	@Field("last_used_at")
	private Instant lastUsedAt;

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

	public UUID getPatientId() {
		return patientId;
	}

	public String getTokenHash() {
		return tokenHash;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public Instant getLastUsedAt() {
		return lastUsedAt;
	}

	public boolean isActive() {
		return active;
	}
}

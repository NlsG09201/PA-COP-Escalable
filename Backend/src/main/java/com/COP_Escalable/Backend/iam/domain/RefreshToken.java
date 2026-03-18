package com.COP_Escalable.Backend.iam.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {
	@Id
	@Column(nullable = false, updatable = false)
	private UUID id;

	@Column(nullable = false, updatable = false)
	private UUID organizationId;

	@Column
	private UUID siteId;

	@Column(nullable = false, updatable = false)
	private UUID userId;

	@Column(nullable = false, updatable = false)
	private String tokenHash;

	@Column(nullable = false, updatable = false)
	private Instant issuedAt;

	@Column(nullable = false, updatable = false)
	private Instant expiresAt;

	@Column
	private Instant revokedAt;

	@Column
	private UUID replacedBy;

	@Column
	private String ip;

	@Column
	private String userAgent;

	protected RefreshToken() {}

	public static RefreshToken issue(UUID organizationId, UUID siteId, UUID userId, String tokenHash, Instant issuedAt, Instant expiresAt, String ip, String userAgent) {
		if (organizationId == null) throw new IllegalArgumentException("organizationId is required");
		if (userId == null) throw new IllegalArgumentException("userId is required");
		if (tokenHash == null || tokenHash.isBlank()) throw new IllegalArgumentException("tokenHash is required");
		var rt = new RefreshToken();
		rt.id = UUID.randomUUID();
		rt.organizationId = organizationId;
		rt.siteId = siteId;
		rt.userId = userId;
		rt.tokenHash = tokenHash;
		rt.issuedAt = issuedAt;
		rt.expiresAt = expiresAt;
		rt.ip = ip;
		rt.userAgent = userAgent;
		return rt;
	}

	public boolean isActive(Instant now) {
		return revokedAt == null && expiresAt.isAfter(now);
	}

	public void revoke(Instant now, UUID replacedBy) {
		this.revokedAt = now;
		this.replacedBy = replacedBy;
	}

	public UUID getId() {
		return id;
	}

	public UUID getOrganizationId() {
		return organizationId;
	}

	public UUID getSiteId() {
		return siteId;
	}

	public UUID getUserId() {
		return userId;
	}

	public String getTokenHash() {
		return tokenHash;
	}

	public Instant getIssuedAt() {
		return issuedAt;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public Instant getRevokedAt() {
		return revokedAt;
	}
}


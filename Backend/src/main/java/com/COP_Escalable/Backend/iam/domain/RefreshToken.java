package com.COP_Escalable.Backend.iam.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.UUID;

@Document(collection = "refresh_tokens")
@CompoundIndexes({
		@CompoundIndex(name = "idx_refresh_user_issued", def = "{'user_id': 1, 'issued_at': -1}")
})
public class RefreshToken {
	@Id
	private UUID id;

	@Field("organization_id")
	private UUID organizationId;

	@Field("site_id")
	private UUID siteId;

	@Field("user_id")
	private UUID userId;

	@Indexed(unique = true)
	@Field("token_hash")
	private String tokenHash;

	@Field("issued_at")
	private Instant issuedAt;

	@Field("expires_at")
	private Instant expiresAt;

	@Field("revoked_at")
	private Instant revokedAt;

	@Field("replaced_by")
	private UUID replacedBy;

	private String ip;

	@Field("user_agent")
	private String userAgent;

	/**
	 * When false, this refresh was issued alongside an access token with {@code mfa_verified=false}
	 * (MFA enabled, step-up pending). Rotation is blocked until MFA is completed.
	 * {@code null} on legacy documents: treated as true for backward compatibility.
	 */
	@Field("mfa_step_up_complete")
	private Boolean mfaStepUpComplete;

	protected RefreshToken() {}

	public static RefreshToken issue(
			UUID organizationId,
			UUID siteId,
			UUID userId,
			String tokenHash,
			Instant issuedAt,
			Instant expiresAt,
			String ip,
			String userAgent,
			boolean mfaStepUpComplete
	) {
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
		rt.mfaStepUpComplete = mfaStepUpComplete;
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

	/**
	 * @return false if MFA step-up is still required for this session; {@code null} for legacy tokens (treated as complete).
	 */
	public Boolean getMfaStepUpComplete() {
		return mfaStepUpComplete;
	}
}

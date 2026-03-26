package com.COP_Escalable.Backend.iam.domain;

import com.COP_Escalable.Backend.shared.persistence.AuditableEntity;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.UUID;

@Document(collection = "users")
@CompoundIndexes({
		@CompoundIndex(name = "idx_users_org_username", def = "{'organization_id': 1, 'username': 1}", unique = true)
})
public class UserAccount extends AuditableEntity {

	@Field("organization_id")
	private UUID organizationId;

	@Indexed
	private String username;

	@Field("password_hash")
	private String passwordHash;

	@Field("mfa_enabled")
	private boolean mfaEnabled;

	/**
	 * Encrypted TOTP secret (AES-GCM, base64). Raw secret is never stored.
	 */
	@Field("mfa_totp_secret_enc")
	private String mfaTotpSecretEnc;

	@Field("mfa_totp_secret_set_at")
	private Instant mfaTotpSecretSetAt;

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
		this.mfaEnabled = false;
		this.mfaTotpSecretEnc = null;
		this.mfaTotpSecretSetAt = null;
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

	public boolean isMfaEnabled() {
		return mfaEnabled;
	}

	public String getMfaTotpSecretEnc() {
		return mfaTotpSecretEnc;
	}

	public Instant getMfaTotpSecretSetAt() {
		return mfaTotpSecretSetAt;
	}

	public void setMfaEnabled(boolean enabled) {
		this.mfaEnabled = enabled;
	}

	public void setMfaTotpSecretEnc(String mfaTotpSecretEnc) {
		this.mfaTotpSecretEnc = mfaTotpSecretEnc;
	}

	public void setMfaTotpSecretSetAt(Instant mfaTotpSecretSetAt) {
		this.mfaTotpSecretSetAt = mfaTotpSecretSetAt;
	}
}

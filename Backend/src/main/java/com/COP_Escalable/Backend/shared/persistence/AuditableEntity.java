package com.COP_Escalable.Backend.shared.persistence;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.UUID;

/**
 * Base for MongoDB documents with audit timestamps (replaces JPA AuditableEntity).
 */
public abstract class AuditableEntity {

	@Id
	private UUID id;

	@CreatedDate
	@Field("created_at")
	private Instant createdAt;

	@LastModifiedDate
	@Field("updated_at")
	private Instant updatedAt;

	public void ensureId() {
		if (id == null) {
			id = UUID.randomUUID();
		}
	}

	public UUID getId() {
		return id;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}

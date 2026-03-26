package com.COP_Escalable.Backend.tenancy.domain;

import com.COP_Escalable.Backend.shared.persistence.AuditableEntity;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "organizations")
public class Organization extends AuditableEntity {
	private String name;
	private OrganizationStatus status;

	protected Organization() {}

	public Organization(String name) {
		if (name == null || name.isBlank()) throw new IllegalArgumentException("name is required");
		this.name = name.trim();
		this.status = OrganizationStatus.ACTIVE;
	}

	public String getName() {
		return name;
	}

	public OrganizationStatus getStatus() {
		return status;
	}

	public void suspend() {
		this.status = OrganizationStatus.SUSPENDED;
	}

	public void activate() {
		this.status = OrganizationStatus.ACTIVE;
	}
}

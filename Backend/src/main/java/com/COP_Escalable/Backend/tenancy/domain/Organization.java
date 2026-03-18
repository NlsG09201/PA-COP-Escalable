package com.COP_Escalable.Backend.tenancy.domain;

import com.COP_Escalable.Backend.shared.persistence.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "organizations")
public class Organization extends AuditableEntity {
	@Column(nullable = false)
	private String name;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
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


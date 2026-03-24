package com.COP_Escalable.Backend.catalog.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "professional_service_assignments")
public class ProfessionalServiceAssignment extends TenantScopedEntity {

	@Column(nullable = false)
	private UUID professionalId;

	@ManyToOne(optional = false, fetch = FetchType.LAZY)
	@JoinColumn(name = "service_offering_id", nullable = false)
	private ServiceOffering serviceOffering;

	@Column(nullable = false)
	private boolean active;

	protected ProfessionalServiceAssignment() {}

	public UUID getProfessionalId() {
		return professionalId;
	}

	public ServiceOffering getServiceOffering() {
		return serviceOffering;
	}

	public boolean isActive() {
		return active;
	}
}

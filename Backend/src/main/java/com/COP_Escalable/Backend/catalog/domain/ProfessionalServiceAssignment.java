package com.COP_Escalable.Backend.catalog.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.UUID;

@Document(collection = "professional_service_assignments")
public class ProfessionalServiceAssignment extends TenantScopedEntity {

	@Field("professional_id")
	private UUID professionalId;

	@Field("service_offering_id")
	private UUID serviceOfferingId;

	private boolean active;

	protected ProfessionalServiceAssignment() {}

	public UUID getProfessionalId() {
		return professionalId;
	}

	public UUID getServiceOfferingId() {
		return serviceOfferingId;
	}

	public boolean isActive() {
		return active;
	}
}

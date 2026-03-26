package com.COP_Escalable.Backend.patients.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDate;
import java.util.UUID;

@Document(collection = "patients")
public class Patient extends TenantScopedEntity {
	@Field("external_code")
	private String externalCode;

	@Field("full_name")
	private String fullName;

	@Field("birth_date")
	private LocalDate birthDate;

	private String phone;

	private String email;

	private PatientStatus status;

	protected Patient() {}

	public static Patient create(UUID organizationId, UUID siteId, String externalCode, String fullName, LocalDate birthDate, String phone, String email) {
		if (siteId == null) throw new IllegalArgumentException("siteId is required");
		if (fullName == null || fullName.isBlank()) throw new IllegalArgumentException("fullName is required");
		var p = new Patient();
		p.setTenant(organizationId, siteId);
		p.externalCode = externalCode == null || externalCode.isBlank() ? null : externalCode.trim();
		p.fullName = fullName.trim();
		p.birthDate = birthDate;
		p.phone = phone == null || phone.isBlank() ? null : phone.trim();
		p.email = email == null || email.isBlank() ? null : email.trim().toLowerCase();
		p.status = PatientStatus.ACTIVE;
		return p;
	}

	public String getExternalCode() {
		return externalCode;
	}

	public String getFullName() {
		return fullName;
	}

	public LocalDate getBirthDate() {
		return birthDate;
	}

	public String getPhone() {
		return phone;
	}

	public String getEmail() {
		return email;
	}

	public PatientStatus getStatus() {
		return status;
	}
}

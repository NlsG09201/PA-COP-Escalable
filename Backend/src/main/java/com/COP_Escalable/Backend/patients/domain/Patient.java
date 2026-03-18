package com.COP_Escalable.Backend.patients.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "patients")
public class Patient extends TenantScopedEntity {
	@Column
	private String externalCode;

	@Column(nullable = false)
	private String fullName;

	@Column
	private LocalDate birthDate;

	@Column
	private String phone;

	@Column
	private String email;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
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


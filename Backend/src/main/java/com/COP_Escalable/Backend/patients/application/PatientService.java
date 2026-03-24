package com.COP_Escalable.Backend.patients.application;

import com.COP_Escalable.Backend.patients.domain.Patient;
import com.COP_Escalable.Backend.patients.infrastructure.PatientRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class PatientService {
	private final PatientRepository patients;
	private final ApplicationEventPublisher eventPublisher;

	public PatientService(PatientRepository patients, ApplicationEventPublisher eventPublisher) {
		this.patients = patients;
		this.eventPublisher = eventPublisher;
	}

	@Transactional(readOnly = true)
	public List<Patient> listForCurrentSite() {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) throw new IllegalArgumentException("site_id is required in tenant context");
		return patients.findAllByOrganizationIdAndSiteId(ctx.organizationId(), ctx.siteId());
	}

	@Transactional
	public Patient create(String externalCode, String fullName, LocalDate birthDate, String phone, String email) {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) throw new IllegalArgumentException("site_id is required in tenant context");
		var p = Patient.create(ctx.organizationId(), ctx.siteId(), externalCode, fullName, birthDate, phone, email);
		var saved = patients.save(p);
		eventPublisher.publishEvent(new PatientRegisteredEvent(
				saved.getOrganizationId(),
				saved.getSiteId(),
				saved.getId(),
				saved.getCreatedAt()
		));
		return saved;
	}

	@Transactional(readOnly = true)
	public Patient requireById(UUID patientId) {
		var ctx = TenantContextHolder.require();
		return patients.findByIdAndOrganizationId(patientId, ctx.organizationId())
				.orElseThrow(() -> new IllegalArgumentException("Patient not found"));
	}
}


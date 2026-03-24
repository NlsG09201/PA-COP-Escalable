package com.COP_Escalable.Backend.clinical.application;

import com.COP_Escalable.Backend.clinical.domain.ClinicalRecord;
import com.COP_Escalable.Backend.clinical.infrastructure.ClinicalRecordRepository;
import com.COP_Escalable.Backend.patients.infrastructure.PatientRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class ClinicalRecordService {
	private final ClinicalRecordRepository records;
	private final PatientRepository patients;
	private final ApplicationEventPublisher eventPublisher;

	public ClinicalRecordService(
			ClinicalRecordRepository records,
			PatientRepository patients,
			ApplicationEventPublisher eventPublisher
	) {
		this.records = records;
		this.patients = patients;
		this.eventPublisher = eventPublisher;
	}

	@Transactional(readOnly = true)
	public ClinicalRecord getOrCreateFor(UUID patientId) {
		var tenant = TenantContextHolder.require();
		var orgId = tenant.organizationId();
		var siteId = tenant.siteId();
		if (siteId == null) throw new IllegalArgumentException("siteId is required in tenant context");

		patients.findByIdAndOrganizationId(patientId, orgId)
				.orElseThrow(() -> new IllegalArgumentException("Patient not found in tenant"));

		return records.findTopByOrganizationIdAndSiteIdAndPatientIdOrderByUpdatedAtDesc(orgId, siteId, patientId)
				.orElseGet(() -> records.save(new ClinicalRecord(orgId, siteId, patientId)));
	}

	@Transactional
	public ClinicalRecord addEntry(UUID patientId, UUID authorUserId, String authorUsername, String type, String note) {
		var record = getOrCreateFor(patientId);
		record.addEntry(authorUserId, authorUsername, type, note);
		return records.save(record);
	}

	@Transactional
	public ClinicalRecord createMedicalAlert(
			UUID patientId,
			UUID authorUserId,
			String authorUsername,
			String title,
			String message,
			String severity
	) {
		var record = getOrCreateFor(patientId);
		String normalizedTitle = requireText(title, "title");
		String normalizedMessage = requireText(message, "message");
		String normalizedSeverity = normalizeSeverity(severity);

		record.addEntry(
				authorUserId,
				authorUsername,
				"MEDICAL_ALERT",
				"[" + normalizedSeverity + "] " + normalizedTitle + System.lineSeparator() + normalizedMessage
		);
		var saved = records.save(record);
		eventPublisher.publishEvent(new MedicalAlertNotificationEvent(
				saved.getOrganizationId(),
				saved.getSiteId(),
				saved.getPatientId(),
				saved.getId(),
				normalizedTitle,
				normalizedMessage,
				normalizedSeverity,
				authorUsername,
				Instant.now()
		));
		return saved;
	}

	private String requireText(String value, String fieldName) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException(fieldName + " is required");
		}
		return value.trim();
	}

	private String normalizeSeverity(String severity) {
		if (severity == null || severity.isBlank()) {
			return "HIGH";
		}
		return severity.trim().toUpperCase();
	}
}


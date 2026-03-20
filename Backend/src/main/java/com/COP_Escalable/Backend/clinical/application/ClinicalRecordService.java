package com.COP_Escalable.Backend.clinical.application;

import com.COP_Escalable.Backend.clinical.domain.ClinicalRecord;
import com.COP_Escalable.Backend.clinical.infrastructure.ClinicalRecordRepository;
import com.COP_Escalable.Backend.patients.infrastructure.PatientRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class ClinicalRecordService {
	private final ClinicalRecordRepository records;
	private final PatientRepository patients;

	public ClinicalRecordService(ClinicalRecordRepository records, PatientRepository patients) {
		this.records = records;
		this.patients = patients;
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
}


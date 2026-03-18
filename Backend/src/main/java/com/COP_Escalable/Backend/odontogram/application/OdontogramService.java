package com.COP_Escalable.Backend.odontogram.application;

import com.COP_Escalable.Backend.odontogram.domain.Odontogram;
import com.COP_Escalable.Backend.odontogram.infrastructure.OdontogramRepository;
import com.COP_Escalable.Backend.patients.infrastructure.PatientRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Service
public class OdontogramService {
	private final OdontogramRepository odontograms;
	private final PatientRepository patients;

	public OdontogramService(OdontogramRepository odontograms, PatientRepository patients) {
		this.odontograms = odontograms;
		this.patients = patients;
	}

	@Transactional(readOnly = true)
	public Odontogram getOrCreate(UUID patientId) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) throw new IllegalArgumentException("siteId is required in tenant context");
		patients.findByIdAndOrganizationId(patientId, tenant.organizationId())
				.orElseThrow(() -> new IllegalArgumentException("Patient not found in tenant"));

		return odontograms.findByOrganizationIdAndSiteIdAndPatientId(tenant.organizationId(), tenant.siteId(), patientId)
				.orElseGet(() -> odontograms.save(new Odontogram(tenant.organizationId(), tenant.siteId(), patientId)));
	}

	@Transactional
	public Odontogram patchTeeth(UUID patientId, Map<String, String> teeth) {
		var o = getOrCreate(patientId);
		if (teeth == null || teeth.isEmpty()) throw new IllegalArgumentException("teeth is required");
		teeth.forEach(o::upsertTooth);
		return odontograms.save(o);
	}
}


package com.COP_Escalable.Backend.odontogram.application;

import com.COP_Escalable.Backend.odontogram.api.OdontogramDtos;
import com.COP_Escalable.Backend.odontogram.domain.*;
import com.COP_Escalable.Backend.odontogram.infrastructure.OdontogramRepository;
import com.COP_Escalable.Backend.patients.infrastructure.PatientRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class OdontogramService {
	private final OdontogramRepository odontograms;
	private final PatientRepository patients;
	private final ToothFdiValidator fdiValidator;
	private final ClinicalTextSanitizer sanitizer;

	public OdontogramService(
			OdontogramRepository odontograms,
			PatientRepository patients,
			ToothFdiValidator fdiValidator,
			ClinicalTextSanitizer sanitizer) {
		this.odontograms = odontograms;
		this.patients = patients;
		this.fdiValidator = fdiValidator;
		this.sanitizer = sanitizer;
	}

	@Transactional
	public Odontogram getOrCreate(UUID patientId) {
		var tenant = TenantContextHolder.require();
		if (tenant.siteId() == null) throw new IllegalArgumentException("siteId is required in tenant context");
		patients.findByIdAndOrganizationId(patientId, tenant.organizationId())
				.orElseThrow(() -> new IllegalArgumentException("Patient not found in tenant"));

		var o = odontograms.findByOrganizationIdAndSiteIdAndPatientId(tenant.organizationId(), tenant.siteId(), patientId)
				.orElseGet(() -> new Odontogram(tenant.organizationId(), tenant.siteId(), patientId));
		if (o.hydrateClinicalFromLegacy()) {
			return odontograms.save(o);
		}
		if (!odontograms.existsById(o.getId())) {
			return odontograms.save(o);
		}
		return o;
	}

	@Transactional
	public Odontogram patch(UUID patientId, OdontogramDtos.PatchRequest req) {
		var o = getOrCreate(patientId);
		if (req.teeth() != null && !req.teeth().isEmpty()) {
			req.teeth().forEach((tooth, state) -> {
				fdiValidator.requireValid(tooth);
				o.upsertTooth(tooth, state);
			});
		}
		if (req.clinicalTooth() != null) {
			applyClinicalPatch(o, req.clinicalTooth());
		}
		if (req.simulation() != null) {
			applySimulationPatch(o, req.simulation());
		}
		return odontograms.save(o);
	}

	/** @deprecated Prefer {@link #patch(UUID, OdontogramDtos.PatchRequest)} with full clinical payload. */
	@Deprecated
	@Transactional
	public Odontogram patchTeeth(UUID patientId, Map<String, String> teeth) {
		return patch(patientId, new OdontogramDtos.PatchRequest(teeth, null, null));
	}

	private void applyClinicalPatch(Odontogram o, OdontogramDtos.ClinicalToothPatch p) {
		fdiValidator.requireValid(p.tooth());
		var tooth = p.tooth().trim();
		var allowedDamage = ToothClinicalState.allowedDamageNames();
		var damages = (p.damages() == null ? List.<String>of() : p.damages()).stream()
				.map(String::trim)
				.map(String::toUpperCase)
				.filter(allowedDamage::contains)
				.distinct()
				.collect(Collectors.toCollection(ArrayList::new));

		var status = normalizeClinicalStatus(p.status());
		var diagnosis = sanitizer.sanitize(p.diagnosis());
		var treatment = sanitizer.sanitize(p.treatment());
		var observations = sanitizer.sanitize(p.clinicalObservations());

		var existing = o.getClinicalTeeth() != null ? o.getClinicalTeeth().get(tooth) : null;
		var next = existing != null ? cloneState(existing) : new ToothClinicalState();
		next.setStatus(status);
		next.setBraces(p.braces());
		next.setDamages(damages);
		next.setDiagnosis(diagnosis);
		next.setTreatment(treatment);
		next.setClinicalObservations(observations);
		next.setUpdatedAt(Instant.now());

		if (p.appendHistory()) {
			var hist = new ArrayList<>(next.getProgressHistory() != null ? next.getProgressHistory() : List.of());
			hist.add(0, new ToothHistoryEvent(
					Instant.now(),
					status,
					diagnosis,
					treatment,
					observations
			));
			while (hist.size() > 200) hist.remove(hist.size() - 1);
			next.setProgressHistory(hist);
		}

		o.upsertClinicalTooth(tooth, next);
	}

	private void applySimulationPatch(Odontogram o, OdontogramDtos.SimulationPatch p) {
		var sim = new OrthodonticSimulation();
		sim.setPlannedDurationMonths(p.plannedDurationMonths());
		sim.setNotes(sanitizer.sanitize(p.notes()));
		var kfs = new ArrayList<SimulationKeyframe>();
		double lastT = -1;
		for (var k : p.keyframes()) {
			if (k.t() < lastT) throw new IllegalArgumentException("Simulation keyframes must be sorted by ascending t");
			lastT = k.t();
			var sk = new SimulationKeyframe();
			sk.setT(k.t());
			var poses = new HashMap<String, ToothPose>();
			for (var e : k.toothPoses().entrySet()) {
				fdiValidator.requireValid(e.getKey());
				poses.put(e.getKey().trim(), e.getValue());
			}
			sk.setToothPoses(poses);
			kfs.add(sk);
		}
		sim.setKeyframes(kfs);
		o.setOrthoSimulation(sim);
		o.markUpdated();
	}

	private static ToothClinicalState cloneState(ToothClinicalState s) {
		var c = new ToothClinicalState();
		c.setStatus(s.getStatus());
		c.setBraces(s.isBraces());
		c.setDamages(new ArrayList<>(s.getDamages() != null ? s.getDamages() : List.of()));
		c.setDiagnosis(s.getDiagnosis());
		c.setTreatment(s.getTreatment());
		c.setClinicalObservations(s.getClinicalObservations());
		c.setUpdatedAt(s.getUpdatedAt());
		c.setProgressHistory(new ArrayList<>(s.getProgressHistory() != null ? s.getProgressHistory() : List.of()));
		return c;
	}

	private static String normalizeClinicalStatus(String raw) {
		if (raw == null || raw.isBlank()) return ToothClinicalStatus.HEALTHY.name();
		try {
			return ToothClinicalStatus.valueOf(raw.trim().toUpperCase()).name();
		} catch (IllegalArgumentException e) {
			return ToothClinicalStatus.HEALTHY.name();
		}
	}
}

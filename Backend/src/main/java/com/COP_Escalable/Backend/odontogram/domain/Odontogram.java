package com.COP_Escalable.Backend.odontogram.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Document("odontograms")
public class Odontogram {
	@Id
	private UUID id;

	@Indexed
	private UUID organizationId;

	@Indexed
	private UUID siteId;

	@Indexed
	private UUID patientId;

	private Instant createdAt;
	private Instant updatedAt;

	/**
	 * Key: tooth code (FDI, e.g. "11", "36"). Value: arbitrary state payload (e.g. "healthy", "caries", "missing").
	 * Kept for backward compatibility and quick filters; mirrors primary {@link ToothClinicalState#getStatus()}.
	 */
	private Map<String, String> teeth = new HashMap<>();

	/** Rich per-tooth clinical model (braces, damage markers, observations, history). */
	private Map<String, ToothClinicalState> clinicalTeeth = new LinkedHashMap<>();

	/** Optional orthodontic 3D simulation timeline (normalized t in [0,1]). */
	private OrthodonticSimulation orthoSimulation;

	/** Reserved hooks for future AI / analytics plugins (small key-value metadata only). */
	private Map<String, String> integrationExtensions = new HashMap<>();

	protected Odontogram() {}

	public Odontogram(UUID organizationId, UUID siteId, UUID patientId) {
		this.id = UUID.randomUUID();
		this.organizationId = require(organizationId, "organizationId");
		this.siteId = siteId;
		this.patientId = require(patientId, "patientId");
		var now = Instant.now();
		this.createdAt = now;
		this.updatedAt = now;
	}

	public void upsertTooth(String tooth, String state) {
		if (tooth == null || tooth.isBlank()) throw new IllegalArgumentException("tooth is required");
		if (state == null || state.isBlank()) throw new IllegalArgumentException("state is required");
		var key = tooth.trim();
		var val = state.trim();
		teeth.put(key, val);
		if (clinicalTeeth != null) {
			var c = clinicalTeeth.get(key);
			if (c != null) {
				c.setStatus(normalizeStatusToken(val));
				c.setUpdatedAt(Instant.now());
			}
		}
		markUpdated();
	}

	public UUID getId() { return id; }
	public UUID getOrganizationId() { return organizationId; }
	public UUID getSiteId() { return siteId; }
	public UUID getPatientId() { return patientId; }
	public Instant getCreatedAt() { return createdAt; }
	public Instant getUpdatedAt() { return updatedAt; }
	public Map<String, String> getTeeth() { return Map.copyOf(teeth); }
	public Map<String, ToothClinicalState> getClinicalTeeth() {
		return clinicalTeeth;
	}

	public void setClinicalTeeth(Map<String, ToothClinicalState> clinicalTeeth) {
		this.clinicalTeeth = clinicalTeeth != null ? new LinkedHashMap<>(clinicalTeeth) : new LinkedHashMap<>();
	}

	public OrthodonticSimulation getOrthoSimulation() { return orthoSimulation; }
	public void setOrthoSimulation(OrthodonticSimulation orthoSimulation) { this.orthoSimulation = orthoSimulation; }

	public Map<String, String> getIntegrationExtensions() {
		return integrationExtensions;
	}

	public void setIntegrationExtensions(Map<String, String> integrationExtensions) {
		this.integrationExtensions = integrationExtensions != null ? new HashMap<>(integrationExtensions) : new HashMap<>();
	}

	/**
	 * Builds {@link #clinicalTeeth} from legacy {@link #teeth} string map when the rich model is absent.
	 */
	public boolean hydrateClinicalFromLegacy() {
		if (clinicalTeeth == null) clinicalTeeth = new LinkedHashMap<>();
		if (!clinicalTeeth.isEmpty() || teeth.isEmpty()) return false;
		for (var e : teeth.entrySet()) {
			var s = new ToothClinicalState();
			s.setStatus(normalizeStatusToken(e.getValue()));
			s.setBraces(false);
			s.setDamages(new java.util.ArrayList<>());
			s.setDiagnosis("");
			s.setTreatment("");
			s.setClinicalObservations("");
			s.setUpdatedAt(updatedAt != null ? updatedAt : createdAt);
			s.setProgressHistory(new java.util.ArrayList<>());
			clinicalTeeth.put(e.getKey(), s);
		}
		return true;
	}

	private static String normalizeStatusToken(String raw) {
		if (raw == null || raw.isBlank()) return ToothClinicalStatus.HEALTHY.name();
		var u = raw.trim().toUpperCase();
		try {
			return ToothClinicalStatus.valueOf(u).name();
		} catch (IllegalArgumentException ex) {
			return ToothClinicalStatus.HEALTHY.name();
		}
	}

	public void upsertClinicalTooth(String tooth, ToothClinicalState state) {
		if (tooth == null || tooth.isBlank()) throw new IllegalArgumentException("tooth is required");
		if (state == null) throw new IllegalArgumentException("state is required");
		if (clinicalTeeth == null) clinicalTeeth = new LinkedHashMap<>();
		clinicalTeeth.put(tooth.trim(), state);
		var status = state.getStatus() != null ? state.getStatus().trim() : ToothClinicalStatus.HEALTHY.name();
		teeth.put(tooth.trim(), status);
		markUpdated();
	}

	public void markUpdated() {
		updatedAt = Instant.now();
	}

	private static UUID require(UUID v, String name) {
		if (v == null) throw new IllegalArgumentException(name + " is required");
		return v;
	}
}


package com.COP_Escalable.Backend.personalization.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Document("patient_preference_profiles")
public class PatientPreferenceProfile {

	@Id
	private UUID id;

	@Indexed
	private UUID organizationId;

	@Indexed
	private UUID siteId;

	@Indexed
	private UUID patientId;

	private List<String> preferredTherapyCategories = new ArrayList<>();

	private String communicationPreference;

	private List<String> preferredAppointmentTimes = new ArrayList<>();

	private String engagementLevel;

	private Map<String, Double> adaptationFactors = new HashMap<>();

	private Instant lastCalculatedAt;
	private Instant createdAt;
	private Instant updatedAt;

	protected PatientPreferenceProfile() {}

	public PatientPreferenceProfile(UUID organizationId, UUID siteId, UUID patientId) {
		this.id = UUID.randomUUID();
		this.organizationId = organizationId;
		this.siteId = siteId;
		this.patientId = patientId;
		var now = Instant.now();
		this.createdAt = now;
		this.updatedAt = now;
	}

	public void recalculate(List<String> therapyCategories,
							String communicationPref,
							List<String> appointmentTimes,
							String engagement,
							Map<String, Double> factors) {
		this.preferredTherapyCategories = therapyCategories != null ? therapyCategories : new ArrayList<>();
		this.communicationPreference = communicationPref;
		this.preferredAppointmentTimes = appointmentTimes != null ? appointmentTimes : new ArrayList<>();
		this.engagementLevel = engagement;
		this.adaptationFactors = factors != null ? factors : new HashMap<>();
		this.lastCalculatedAt = Instant.now();
		this.updatedAt = Instant.now();
	}

	public UUID getId() { return id; }
	public UUID getOrganizationId() { return organizationId; }
	public UUID getSiteId() { return siteId; }
	public UUID getPatientId() { return patientId; }
	public List<String> getPreferredTherapyCategories() { return preferredTherapyCategories; }
	public String getCommunicationPreference() { return communicationPreference; }
	public List<String> getPreferredAppointmentTimes() { return preferredAppointmentTimes; }
	public String getEngagementLevel() { return engagementLevel; }
	public Map<String, Double> getAdaptationFactors() { return adaptationFactors; }
	public Instant getLastCalculatedAt() { return lastCalculatedAt; }
	public Instant getCreatedAt() { return createdAt; }
	public Instant getUpdatedAt() { return updatedAt; }
}

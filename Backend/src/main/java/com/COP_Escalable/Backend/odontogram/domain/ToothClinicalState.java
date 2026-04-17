package com.COP_Escalable.Backend.odontogram.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

public class ToothClinicalState {
	private String status = ToothClinicalStatus.HEALTHY.name();
	private boolean braces;
	private List<String> damages = new ArrayList<>();
	private String diagnosis = "";
	private String treatment = "";
	private String clinicalObservations = "";
	private Instant updatedAt;
	private List<ToothHistoryEvent> progressHistory = new ArrayList<>();

	public String getStatus() { return status; }
	public void setStatus(String status) { this.status = status; }
	public boolean isBraces() { return braces; }
	public void setBraces(boolean braces) { this.braces = braces; }
	public List<String> getDamages() { return damages; }
	public void setDamages(List<String> damages) { this.damages = damages != null ? damages : new ArrayList<>(); }
	public String getDiagnosis() { return diagnosis; }
	public void setDiagnosis(String diagnosis) { this.diagnosis = diagnosis; }
	public String getTreatment() { return treatment; }
	public void setTreatment(String treatment) { this.treatment = treatment; }
	public String getClinicalObservations() { return clinicalObservations; }
	public void setClinicalObservations(String clinicalObservations) { this.clinicalObservations = clinicalObservations; }
	public Instant getUpdatedAt() { return updatedAt; }
	public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
	public List<ToothHistoryEvent> getProgressHistory() { return progressHistory; }
	public void setProgressHistory(List<ToothHistoryEvent> progressHistory) {
		this.progressHistory = progressHistory != null ? progressHistory : new ArrayList<>();
	}

	public static Set<String> allowedDamageNames() {
		return EnumSet.allOf(DamageFinding.class).stream().map(Enum::name).collect(Collectors.toSet());
	}
}

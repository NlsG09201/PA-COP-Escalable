package com.COP_Escalable.Backend.odontogram.domain;

import java.time.Instant;

/**
 * Immutable-style persistence bean for MongoDB (setters required by Spring Data).
 */
public class ToothHistoryEvent {
	private Instant at;
	private String status;
	private String diagnosis;
	private String treatment;
	private String observations;

	public ToothHistoryEvent() {}

	public ToothHistoryEvent(Instant at, String status, String diagnosis, String treatment, String observations) {
		this.at = at;
		this.status = status;
		this.diagnosis = diagnosis;
		this.treatment = treatment;
		this.observations = observations;
	}

	public Instant getAt() { return at; }
	public void setAt(Instant at) { this.at = at; }
	public String getStatus() { return status; }
	public void setStatus(String status) { this.status = status; }
	public String getDiagnosis() { return diagnosis; }
	public void setDiagnosis(String diagnosis) { this.diagnosis = diagnosis; }
	public String getTreatment() { return treatment; }
	public void setTreatment(String treatment) { this.treatment = treatment; }
	public String getObservations() { return observations; }
	public void setObservations(String observations) { this.observations = observations; }
}

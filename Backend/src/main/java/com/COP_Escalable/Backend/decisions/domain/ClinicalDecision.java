package com.COP_Escalable.Backend.decisions.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.UUID;

@Document(collection = "clinical_decisions")
public class ClinicalDecision extends TenantScopedEntity {

	@Field("patient_id")
	private UUID patientId;

	@Field("decision_type")
	private String decisionType;

	@Field("input_json")
	private String inputJson;

	@Field("output_json")
	private String outputJson;

	@Field("model_version")
	private String modelVersion;

	private Boolean accepted;

	@Field("accepted_by")
	private UUID acceptedBy;

	protected ClinicalDecision() {}

	public static ClinicalDecision create(UUID organizationId, UUID siteId, UUID patientId,
										  String decisionType, String inputJson,
										  String outputJson, String modelVersion) {
		var decision = new ClinicalDecision();
		decision.setTenant(organizationId, siteId);
		decision.patientId = patientId;
		decision.decisionType = decisionType;
		decision.inputJson = inputJson;
		decision.outputJson = outputJson;
		decision.modelVersion = modelVersion;
		return decision;
	}

	public void accept(UUID userId) {
		this.accepted = true;
		this.acceptedBy = userId;
	}

	public UUID getPatientId() {
		return patientId;
	}

	public String getDecisionType() {
		return decisionType;
	}

	public String getInputJson() {
		return inputJson;
	}

	public String getOutputJson() {
		return outputJson;
	}

	public String getModelVersion() {
		return modelVersion;
	}

	public Boolean getAccepted() {
		return accepted;
	}

	public UUID getAcceptedBy() {
		return acceptedBy;
	}
}

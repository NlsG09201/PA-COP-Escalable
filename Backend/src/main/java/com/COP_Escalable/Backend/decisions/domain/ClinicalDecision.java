package com.COP_Escalable.Backend.decisions.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "clinical_decisions")
public class ClinicalDecision extends TenantScopedEntity {

	@Column(nullable = false)
	private UUID patientId;

	@Column(nullable = false, length = 50)
	private String decisionType;

	@Column(columnDefinition = "jsonb")
	private String inputJson;

	@Column(columnDefinition = "jsonb")
	private String outputJson;

	@Column(length = 50)
	private String modelVersion;

	private Boolean accepted;

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

	public UUID getPatientId() { return patientId; }
	public String getDecisionType() { return decisionType; }
	public String getInputJson() { return inputJson; }
	public String getOutputJson() { return outputJson; }
	public String getModelVersion() { return modelVersion; }
	public Boolean getAccepted() { return accepted; }
	public UUID getAcceptedBy() { return acceptedBy; }
}

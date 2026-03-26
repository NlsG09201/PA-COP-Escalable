package com.COP_Escalable.Backend.relapse.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Document(collection = "relapse_alerts")
public class RelapseAlert extends TenantScopedEntity {

	@Field("patient_id")
	private UUID patientId;

	@Field("risk_score")
	private BigDecimal riskScore;

	@Field("risk_level")
	private String riskLevel;

	@Field("factors_json")
	private String factorsJson;

	@Field("actions_json")
	private String actionsJson;

	private boolean acknowledged;

	@Field("acknowledged_by")
	private UUID acknowledgedBy;

	@Field("acknowledged_at")
	private Instant acknowledgedAt;

	protected RelapseAlert() {}

	public static RelapseAlert create(UUID organizationId, UUID siteId, UUID patientId,
									  BigDecimal riskScore, String riskLevel,
									  String factorsJson, String actionsJson) {
		var alert = new RelapseAlert();
		alert.setTenant(organizationId, siteId);
		alert.patientId = patientId;
		alert.riskScore = riskScore;
		alert.riskLevel = riskLevel;
		alert.factorsJson = factorsJson;
		alert.actionsJson = actionsJson;
		alert.acknowledged = false;
		return alert;
	}

	public void acknowledge(UUID userId) {
		this.acknowledged = true;
		this.acknowledgedBy = userId;
		this.acknowledgedAt = Instant.now();
	}

	public UUID getPatientId() {
		return patientId;
	}

	public BigDecimal getRiskScore() {
		return riskScore;
	}

	public String getRiskLevel() {
		return riskLevel;
	}

	public String getFactorsJson() {
		return factorsJson;
	}

	public String getActionsJson() {
		return actionsJson;
	}

	public boolean isAcknowledged() {
		return acknowledged;
	}

	public UUID getAcknowledgedBy() {
		return acknowledgedBy;
	}

	public Instant getAcknowledgedAt() {
		return acknowledgedAt;
	}
}

package com.COP_Escalable.Backend.relapse.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "relapse_alerts")
public class RelapseAlert extends TenantScopedEntity {

	@Column(nullable = false)
	private UUID patientId;

	@Column(nullable = false, precision = 5, scale = 4)
	private BigDecimal riskScore;

	@Column(nullable = false, length = 20)
	private String riskLevel;

	@Column(columnDefinition = "jsonb")
	private String factorsJson;

	@Column(columnDefinition = "jsonb")
	private String actionsJson;

	@Column(nullable = false)
	private boolean acknowledged;

	private UUID acknowledgedBy;

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

	public UUID getPatientId() { return patientId; }
	public BigDecimal getRiskScore() { return riskScore; }
	public String getRiskLevel() { return riskLevel; }
	public String getFactorsJson() { return factorsJson; }
	public String getActionsJson() { return actionsJson; }
	public boolean isAcknowledged() { return acknowledged; }
	public UUID getAcknowledgedBy() { return acknowledgedBy; }
	public Instant getAcknowledgedAt() { return acknowledgedAt; }
}

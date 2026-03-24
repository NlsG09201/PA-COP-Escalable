package com.COP_Escalable.Backend.experience.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "churn_predictions")
public class ChurnPrediction extends TenantScopedEntity {

	@Column(nullable = false)
	private UUID patientId;

	@Column(nullable = false, precision = 5, scale = 4)
	private BigDecimal churnScore;

	@Column(nullable = false, length = 20)
	private String riskLevel;

	@Column(columnDefinition = "jsonb")
	private String factorsJson;

	@Column(columnDefinition = "jsonb")
	private String actionsJson;

	@Column(length = 50)
	private String modelVersion;

	protected ChurnPrediction() {}

	public static ChurnPrediction create(UUID organizationId, UUID siteId, UUID patientId,
										 BigDecimal churnScore, String riskLevel,
										 String factorsJson, String actionsJson, String modelVersion) {
		var prediction = new ChurnPrediction();
		prediction.setTenant(organizationId, siteId);
		prediction.patientId = patientId;
		prediction.churnScore = churnScore;
		prediction.riskLevel = riskLevel;
		prediction.factorsJson = factorsJson;
		prediction.actionsJson = actionsJson;
		prediction.modelVersion = modelVersion;
		return prediction;
	}

	public UUID getPatientId() { return patientId; }
	public BigDecimal getChurnScore() { return churnScore; }
	public String getRiskLevel() { return riskLevel; }
	public String getFactorsJson() { return factorsJson; }
	public String getActionsJson() { return actionsJson; }
	public String getModelVersion() { return modelVersion; }
}

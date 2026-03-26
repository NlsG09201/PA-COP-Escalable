package com.COP_Escalable.Backend.experience.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.math.BigDecimal;
import java.util.UUID;

@Document(collection = "churn_predictions")
public class ChurnPrediction extends TenantScopedEntity {

	@Field("patient_id")
	private UUID patientId;

	@Field("churn_score")
	private BigDecimal churnScore;

	@Field("risk_level")
	private String riskLevel;

	@Field("factors_json")
	private String factorsJson;

	@Field("actions_json")
	private String actionsJson;

	@Field("model_version")
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

	public UUID getPatientId() {
		return patientId;
	}

	public BigDecimal getChurnScore() {
		return churnScore;
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

	public String getModelVersion() {
		return modelVersion;
	}
}

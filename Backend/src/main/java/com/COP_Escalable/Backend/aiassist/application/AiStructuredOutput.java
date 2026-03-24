package com.COP_Escalable.Backend.aiassist.application;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

/**
 * Contrato JSON V1 para salida del modelo. Solo hipótesis asistivas; revisión humana obligatoria en producto.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class AiStructuredOutput {

	@JsonProperty("disclaimer")
	private String disclaimer;

	@JsonProperty("risk_level")
	private String riskLevel;

	@JsonProperty("human_review_required")
	private Boolean humanReviewRequired;

	@JsonProperty("candidate_conditions")
	private List<CandidateCondition> candidateConditions = new ArrayList<>();

	@JsonProperty("supporting_signals")
	private List<String> supportingSignals = new ArrayList<>();

	@JsonProperty("recommended_clarifying_questions")
	private List<String> recommendedClarifyingQuestions = new ArrayList<>();

	@JsonProperty("recommended_non_diagnostic_actions")
	private List<String> recommendedNonDiagnosticActions = new ArrayList<>();

	@JsonProperty("sentiment_analysis")
	private SentimentAnalysis sentimentAnalysis;

	@JsonProperty("clinical_metrics")
	private java.util.Map<String, Double> clinicalMetrics = new java.util.HashMap<>();

	@JsonProperty("evidence_quotes_from_input")
	private List<String> evidenceQuotesFromInput = new ArrayList<>();

	public SentimentAnalysis getSentimentAnalysis() {
		return sentimentAnalysis;
	}

	public void setSentimentAnalysis(SentimentAnalysis sentimentAnalysis) {
		this.sentimentAnalysis = sentimentAnalysis;
	}

	public java.util.Map<String, Double> getClinicalMetrics() {
		return clinicalMetrics;
	}

	public void setClinicalMetrics(java.util.Map<String, Double> clinicalMetrics) {
		this.clinicalMetrics = clinicalMetrics != null ? clinicalMetrics : new java.util.HashMap<>();
	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class SentimentAnalysis {
		@JsonProperty("label")
		private String label; // positive, neutral, negative, mixed

		@JsonProperty("score")
		private Double score; // -1.0 to 1.0

		public String getLabel() { return label; }
		public void setLabel(String label) { this.label = label; }
		public Double getScore() { return score; }
		public void setScore(Double score) { this.score = score; }
	}

	public String getDisclaimer() {
		return disclaimer;
	}

	public void setDisclaimer(String disclaimer) {
		this.disclaimer = disclaimer;
	}

	public String getRiskLevel() {
		return riskLevel;
	}

	public void setRiskLevel(String riskLevel) {
		this.riskLevel = riskLevel;
	}

	public Boolean getHumanReviewRequired() {
		return humanReviewRequired;
	}

	public void setHumanReviewRequired(Boolean humanReviewRequired) {
		this.humanReviewRequired = humanReviewRequired;
	}

	public List<CandidateCondition> getCandidateConditions() {
		return candidateConditions;
	}

	public void setCandidateConditions(List<CandidateCondition> candidateConditions) {
		this.candidateConditions = candidateConditions != null ? candidateConditions : new ArrayList<>();
	}

	public List<String> getSupportingSignals() {
		return supportingSignals;
	}

	public void setSupportingSignals(List<String> supportingSignals) {
		this.supportingSignals = supportingSignals != null ? supportingSignals : new ArrayList<>();
	}

	public List<String> getRecommendedClarifyingQuestions() {
		return recommendedClarifyingQuestions;
	}

	public void setRecommendedClarifyingQuestions(List<String> recommendedClarifyingQuestions) {
		this.recommendedClarifyingQuestions = recommendedClarifyingQuestions != null ? recommendedClarifyingQuestions : new ArrayList<>();
	}

	public List<String> getRecommendedNonDiagnosticActions() {
		return recommendedNonDiagnosticActions;
	}

	public void setRecommendedNonDiagnosticActions(List<String> recommendedNonDiagnosticActions) {
		this.recommendedNonDiagnosticActions = recommendedNonDiagnosticActions != null ? recommendedNonDiagnosticActions : new ArrayList<>();
	}

	public List<String> getEvidenceQuotesFromInput() {
		return evidenceQuotesFromInput;
	}

	public void setEvidenceQuotesFromInput(List<String> evidenceQuotesFromInput) {
		this.evidenceQuotesFromInput = evidenceQuotesFromInput != null ? evidenceQuotesFromInput : new ArrayList<>();
	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	public static class CandidateCondition {
		@JsonProperty("label")
		private String label;

		@JsonProperty("rationale")
		private String rationale;

		@JsonProperty("confidence_0_to_1")
		private Double confidence01;

		public String getLabel() {
			return label;
		}

		public void setLabel(String label) {
			this.label = label;
		}

		public String getRationale() {
			return rationale;
		}

		public void setRationale(String rationale) {
			this.rationale = rationale;
		}

		public Double getConfidence01() {
			return confidence01;
		}

		public void setConfidence01(Double confidence01) {
			this.confidence01 = confidence01;
		}
	}
}

package com.COP_Escalable.Backend.aiassist.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.UUID;

@Document("ai_clinical_suggestions")
public class AiClinicalSuggestion {
	@Id
	private UUID id;

	@Indexed
	private UUID organizationId;

	@Indexed
	private UUID siteId;

	@Indexed
	private UUID patientId;

	private AiAssistSourceType sourceType;
	private UUID psychTestSubmissionId;
	private UUID psychTestTemplateId;
	private String psychTestTemplateCode;

	private String modelId;
	private String promptVersion;

	private UUID requestedByUserId;
	private String requestedByUsername;

	private String deterministicScoringSummary;

	private AiSuggestionStatus status;
	private Instant createdAt;
	private Instant reviewedAt;
	private UUID reviewedByUserId;
	private String reviewedByUsername;
	private String reviewNote;

	private String rawModelResponseJson;
	private String parsedJsonFingerprint;

	private String riskLevel;
	private Boolean humanReviewRequired;
	private String headline;
	private String structuredJson;

	protected AiClinicalSuggestion() {
	}

	public static AiClinicalSuggestion createGenericClinical(
			UUID organizationId,
			UUID siteId,
			UUID patientId,
			AiAssistSourceType sourceType,
			String modelId,
			String promptVersion,
			UUID requestedByUserId,
			String requestedByUsername
	) {
		var s = new AiClinicalSuggestion();
		s.id = UUID.randomUUID();
		s.organizationId = require(organizationId, "organizationId");
		s.siteId = require(siteId, "siteId");
		s.patientId = require(patientId, "patientId");
		s.sourceType = require(sourceType, "sourceType");
		s.modelId = modelId;
		s.promptVersion = promptVersion;
		s.requestedByUserId = requestedByUserId;
		s.requestedByUsername = requestedByUsername;
		s.status = AiSuggestionStatus.PENDING_REVIEW; // Initial state if sync
		s.createdAt = Instant.now();
		s.parsedJsonFingerprint = "";
		s.riskLevel = "unknown";
		s.humanReviewRequired = true;
		s.headline = "Análisis IA";
		s.structuredJson = "{}";
		return s;
	}

	public static AiClinicalSuggestion createQueuedPsychTest(
			UUID organizationId,
			UUID siteId,
			UUID patientId,
			UUID psychTestSubmissionId,
			UUID psychTestTemplateId,
			String psychTestTemplateCode,
			String modelId,
			String promptVersion,
			UUID requestedByUserId,
			String requestedByUsername,
			String deterministicScoringSummary
	) {
		var s = new AiClinicalSuggestion();
		s.id = UUID.randomUUID();
		s.organizationId = require(organizationId, "organizationId");
		s.siteId = require(siteId, "siteId");
		s.patientId = require(patientId, "patientId");
		s.sourceType = AiAssistSourceType.PSYCH_TEST_SUBMISSION;
		s.psychTestSubmissionId = psychTestSubmissionId;
		s.psychTestTemplateId = psychTestTemplateId;
		s.psychTestTemplateCode = psychTestTemplateCode;
		s.modelId = modelId;
		s.promptVersion = promptVersion;
		s.requestedByUserId = requestedByUserId;
		s.requestedByUsername = requestedByUsername;
		s.deterministicScoringSummary = deterministicScoringSummary;
		s.status = AiSuggestionStatus.QUEUED;
		s.createdAt = Instant.now();
		s.rawModelResponseJson = null;
		s.parsedJsonFingerprint = "";
		s.riskLevel = "unknown";
		s.humanReviewRequired = true;
		s.headline = "Análisis en cola";
		s.structuredJson = "{}";
		return s;
	}

	public AiClinicalSuggestion(
			UUID organizationId,
			UUID siteId,
			UUID patientId,
			AiAssistSourceType sourceType,
			UUID psychTestSubmissionId,
			UUID psychTestTemplateId,
			String psychTestTemplateCode,
			String modelId,
			String promptVersion,
			AiSuggestionStatus status,
			String rawModelResponseJson,
			String parsedJsonFingerprint,
			String riskLevel,
			Boolean humanReviewRequired,
			String headline,
			String structuredJson,
			UUID requestedByUserId,
			String requestedByUsername,
			String deterministicScoringSummary
	) {
		this.id = UUID.randomUUID();
		this.organizationId = require(organizationId, "organizationId");
		this.siteId = require(siteId, "siteId");
		this.patientId = require(patientId, "patientId");
		this.sourceType = require(sourceType, "sourceType");
		this.psychTestSubmissionId = psychTestSubmissionId;
		this.psychTestTemplateId = psychTestTemplateId;
		this.psychTestTemplateCode = psychTestTemplateCode;
		this.modelId = modelId;
		this.promptVersion = promptVersion;
		this.requestedByUserId = requestedByUserId;
		this.requestedByUsername = requestedByUsername;
		this.deterministicScoringSummary = deterministicScoringSummary;
		this.status = status;
		this.createdAt = Instant.now();
		this.rawModelResponseJson = rawModelResponseJson;
		this.parsedJsonFingerprint = parsedJsonFingerprint;
		this.riskLevel = riskLevel;
		this.humanReviewRequired = humanReviewRequired;
		this.headline = headline;
		this.structuredJson = structuredJson;
	}

	public void applyAnalysisFailure(String raw, String headline, String structuredJson) {
		this.status = AiSuggestionStatus.FAILED;
		this.rawModelResponseJson = raw;
		this.parsedJsonFingerprint = "";
		this.riskLevel = "unknown";
		this.humanReviewRequired = true;
		this.headline = headline;
		this.structuredJson = structuredJson == null ? "{}" : structuredJson;
	}

	public void applyAnalysisSuccess(
			String raw,
			String fingerprint,
			String risk,
			boolean humanReview,
			String headline,
			String structuredJson
	) {
		this.status = AiSuggestionStatus.PENDING_REVIEW;
		this.rawModelResponseJson = raw;
		this.parsedJsonFingerprint = fingerprint;
		this.riskLevel = risk;
		this.humanReviewRequired = humanReview;
		this.headline = headline;
		this.structuredJson = structuredJson;
	}

	public void markApproved(UUID reviewerUserId, String reviewerUsername, String note) {
		this.status = AiSuggestionStatus.APPROVED;
		this.reviewedAt = Instant.now();
		this.reviewedByUserId = reviewerUserId;
		this.reviewedByUsername = reviewerUsername;
		this.reviewNote = note;
	}

	public void markRejected(UUID reviewerUserId, String reviewerUsername, String note) {
		this.status = AiSuggestionStatus.REJECTED;
		this.reviewedAt = Instant.now();
		this.reviewedByUserId = reviewerUserId;
		this.reviewedByUsername = reviewerUsername;
		this.reviewNote = note;
	}

	public UUID getId() {
		return id;
	}

	public UUID getOrganizationId() {
		return organizationId;
	}

	public UUID getSiteId() {
		return siteId;
	}

	public UUID getPatientId() {
		return patientId;
	}

	public AiAssistSourceType getSourceType() {
		return sourceType;
	}

	public UUID getPsychTestSubmissionId() {
		return psychTestSubmissionId;
	}

	public UUID getPsychTestTemplateId() {
		return psychTestTemplateId;
	}

	public String getPsychTestTemplateCode() {
		return psychTestTemplateCode;
	}

	public String getModelId() {
		return modelId;
	}

	public String getPromptVersion() {
		return promptVersion;
	}

	public UUID getRequestedByUserId() {
		return requestedByUserId;
	}

	public String getRequestedByUsername() {
		return requestedByUsername;
	}

	public String getDeterministicScoringSummary() {
		return deterministicScoringSummary;
	}

	public AiSuggestionStatus getStatus() {
		return status;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getReviewedAt() {
		return reviewedAt;
	}

	public UUID getReviewedByUserId() {
		return reviewedByUserId;
	}

	public String getReviewedByUsername() {
		return reviewedByUsername;
	}

	public String getReviewNote() {
		return reviewNote;
	}

	public String getRawModelResponseJson() {
		return rawModelResponseJson;
	}

	public String getParsedJsonFingerprint() {
		return parsedJsonFingerprint;
	}

	public String getRiskLevel() {
		return riskLevel;
	}

	public Boolean getHumanReviewRequired() {
		return humanReviewRequired;
	}

	public String getHeadline() {
		return headline;
	}

	public String getStructuredJson() {
		return structuredJson;
	}

	private static <T> T require(T v, String name) {
		if (v == null) {
			throw new IllegalArgumentException(name + " is required");
		}
		return v;
	}
}

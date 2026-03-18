package com.COP_Escalable.Backend.psychtests.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Document("psych_test_submissions")
public class TestSubmission {
	@Id
	private UUID id;

	@Indexed
	private UUID organizationId;

	@Indexed
	private UUID siteId;

	@Indexed
	private UUID patientId;

	@Indexed
	private UUID templateId;

	private Instant submittedAt;
	private UUID submittedByUserId;
	private String submittedByUsername;

	private Map<String, String> answersByQuestionId = new HashMap<>();

	protected TestSubmission() {}

	public TestSubmission(UUID organizationId, UUID siteId, UUID patientId, UUID templateId, UUID userId, String username, Map<String, String> answersByQuestionId) {
		this.id = UUID.randomUUID();
		this.organizationId = require(organizationId, "organizationId");
		this.siteId = siteId;
		this.patientId = require(patientId, "patientId");
		this.templateId = require(templateId, "templateId");
		this.submittedAt = Instant.now();
		this.submittedByUserId = userId;
		this.submittedByUsername = username;
		if (answersByQuestionId != null) this.answersByQuestionId = new HashMap<>(answersByQuestionId);
	}

	public UUID getId() { return id; }
	public UUID getOrganizationId() { return organizationId; }
	public UUID getSiteId() { return siteId; }
	public UUID getPatientId() { return patientId; }
	public UUID getTemplateId() { return templateId; }
	public Instant getSubmittedAt() { return submittedAt; }
	public UUID getSubmittedByUserId() { return submittedByUserId; }
	public String getSubmittedByUsername() { return submittedByUsername; }
	public Map<String, String> getAnswersByQuestionId() { return Map.copyOf(answersByQuestionId); }

	private static UUID require(UUID v, String name) {
		if (v == null) throw new IllegalArgumentException(name + " is required");
		return v;
	}
}


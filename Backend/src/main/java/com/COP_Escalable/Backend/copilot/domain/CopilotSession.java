package com.COP_Escalable.Backend.copilot.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.UUID;

@Document(collection = "copilot_sessions")
public class CopilotSession extends TenantScopedEntity {

	@Field("patient_id")
	private UUID patientId;

	@Field("professional_id")
	private UUID professionalId;

	@Field("session_type")
	private String sessionType;

	@Field("started_at")
	private Instant startedAt;

	@Field("ended_at")
	private Instant endedAt;

	@Field("summary_text")
	private String summaryText;

	@Field("suggestions_json")
	private String suggestionsJson;

	private String status;

	protected CopilotSession() {}

	public static CopilotSession start(UUID organizationId, UUID siteId,
									   UUID patientId, UUID professionalId, String sessionType) {
		var session = new CopilotSession();
		session.setTenant(organizationId, siteId);
		session.patientId = patientId;
		session.professionalId = professionalId;
		session.sessionType = sessionType;
		session.startedAt = Instant.now();
		session.status = "ACTIVE";
		session.suggestionsJson = "[]";
		return session;
	}

	public void addSuggestion(String suggestionEntry) {
		if (this.suggestionsJson == null || this.suggestionsJson.equals("[]")) {
			this.suggestionsJson = "[" + suggestionEntry + "]";
		} else {
			this.suggestionsJson = this.suggestionsJson.substring(0, this.suggestionsJson.length() - 1)
					+ "," + suggestionEntry + "]";
		}
	}

	public void complete(String summary) {
		this.status = "COMPLETED";
		this.summaryText = summary;
		this.endedAt = Instant.now();
	}

	public void cancel() {
		this.status = "CANCELLED";
		this.endedAt = Instant.now();
	}

	public void setSummaryText(String summaryText) {
		this.summaryText = summaryText;
	}

	public UUID getPatientId() {
		return patientId;
	}

	public UUID getProfessionalId() {
		return professionalId;
	}

	public String getSessionType() {
		return sessionType;
	}

	public Instant getStartedAt() {
		return startedAt;
	}

	public Instant getEndedAt() {
		return endedAt;
	}

	public String getSummaryText() {
		return summaryText;
	}

	public String getSuggestionsJson() {
		return suggestionsJson;
	}

	public String getStatus() {
		return status;
	}
}

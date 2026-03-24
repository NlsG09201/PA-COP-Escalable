package com.COP_Escalable.Backend.copilot.domain;

import com.COP_Escalable.Backend.shared.persistence.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "copilot_sessions")
public class CopilotSession extends TenantScopedEntity {

	@Column(nullable = false)
	private UUID patientId;

	@Column(nullable = false)
	private UUID professionalId;

	@Column(nullable = false, length = 40)
	private String sessionType;

	private Instant startedAt;

	private Instant endedAt;

	@Column(columnDefinition = "text")
	private String summaryText;

	@Column(columnDefinition = "jsonb")
	private String suggestionsJson;

	@Column(nullable = false, length = 20)
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

	public UUID getPatientId() { return patientId; }
	public UUID getProfessionalId() { return professionalId; }
	public String getSessionType() { return sessionType; }
	public Instant getStartedAt() { return startedAt; }
	public Instant getEndedAt() { return endedAt; }
	public String getSummaryText() { return summaryText; }
	public String getSuggestionsJson() { return suggestionsJson; }
	public String getStatus() { return status; }
}

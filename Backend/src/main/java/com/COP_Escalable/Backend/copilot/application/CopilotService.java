package com.COP_Escalable.Backend.copilot.application;

import com.COP_Escalable.Backend.aiassist.application.LlmCompletionClient;
import com.COP_Escalable.Backend.clinical.domain.ClinicalRecord;
import com.COP_Escalable.Backend.clinical.infrastructure.ClinicalRecordRepository;
import com.COP_Escalable.Backend.copilot.domain.CopilotSession;
import com.COP_Escalable.Backend.copilot.infrastructure.CopilotSessionRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class CopilotService {

	private static final Logger log = LoggerFactory.getLogger(CopilotService.class);

	private final CopilotSessionRepository sessionRepository;
	private final ClinicalRecordRepository clinicalRecordRepository;
	private final LlmCompletionClient llmClient;
	private final CopilotProperties properties;
	private final SessionSummaryGenerator summaryGenerator;
	private final ObjectMapper objectMapper;

	public CopilotService(CopilotSessionRepository sessionRepository,
						  ClinicalRecordRepository clinicalRecordRepository,
						  LlmCompletionClient llmClient,
						  CopilotProperties properties,
						  SessionSummaryGenerator summaryGenerator,
						  ObjectMapper objectMapper) {
		this.sessionRepository = sessionRepository;
		this.clinicalRecordRepository = clinicalRecordRepository;
		this.llmClient = llmClient;
		this.properties = properties;
		this.summaryGenerator = summaryGenerator;
		this.objectMapper = objectMapper;
	}

	@Transactional
	public CopilotSession startSession(UUID patientId, UUID professionalId, String sessionType) {
		if (!properties.isEnabled()) {
			throw new IllegalStateException("Copilot is disabled");
		}
		var tenant = TenantContextHolder.require();

		CopilotSession session = CopilotSession.start(
				tenant.organizationId(), tenant.siteId(),
				patientId, professionalId, sessionType
		);

		return sessionRepository.save(session);
	}

	@Transactional
	public String generateSuggestion(UUID sessionId, String currentContext) {
		var session = sessionRepository.findById(sessionId)
				.orElseThrow(() -> new IllegalArgumentException("Session not found"));

		if (!"ACTIVE".equals(session.getStatus())) {
			throw new IllegalStateException("Session is not active");
		}

		List<String> existingSuggestions = parseSuggestions(session.getSuggestionsJson());
		if (existingSuggestions.size() >= properties.getMaxSuggestionsPerSession()) {
			throw new IllegalStateException("Maximum suggestions per session reached");
		}

		String patientContext = loadPatientContext(session);

		String systemPrompt = buildCopilotSystemPrompt(session.getSessionType());
		String userPrompt = "Session type: " + session.getSessionType() + "\n"
				+ "Patient clinical context:\n" + patientContext + "\n\n"
				+ "Previous suggestions in this session:\n" + String.join("\n", existingSuggestions) + "\n\n"
				+ "Current input/observation:\n" + currentContext + "\n\n"
				+ "Provide a concise, actionable clinical suggestion.";

		String suggestion;
		try {
			suggestion = llmClient.complete(systemPrompt, userPrompt);
		} catch (Exception e) {
			log.warn("LLM unavailable for copilot, generating template suggestion: {}", e.getMessage());
			suggestion = generateTemplateSuggestion(session.getSessionType(), currentContext);
		}

		try {
			String escapedSuggestion = objectMapper.writeValueAsString(suggestion);
			session.addSuggestion(escapedSuggestion);
		} catch (JsonProcessingException e) {
			session.addSuggestion("\"" + suggestion.replace("\"", "\\\"") + "\"");
		}
		sessionRepository.save(session);

		return suggestion;
	}

	@Transactional
	public String generateSummary(UUID sessionId) {
		var session = sessionRepository.findById(sessionId)
				.orElseThrow(() -> new IllegalArgumentException("Session not found"));

		List<String> suggestions = parseSuggestions(session.getSuggestionsJson());
		String summary = summaryGenerator.generateSummary(session, suggestions);
		session.setSummaryText(summary);
		sessionRepository.save(session);
		return summary;
	}

	@Transactional
	public CopilotSession endSession(UUID sessionId) {
		var session = sessionRepository.findById(sessionId)
				.orElseThrow(() -> new IllegalArgumentException("Session not found"));

		if (!"ACTIVE".equals(session.getStatus())) {
			throw new IllegalStateException("Session is not active");
		}

		List<String> suggestions = parseSuggestions(session.getSuggestionsJson());
		String summary = summaryGenerator.generateSummary(session, suggestions);
		session.complete(summary);
		return sessionRepository.save(session);
	}

	@Transactional(readOnly = true)
	public List<CopilotSession> getActiveSessions(UUID professionalId) {
		return sessionRepository.findByProfessionalIdAndStatus(professionalId, "ACTIVE");
	}

	@Transactional(readOnly = true)
	public List<CopilotSession> getSessionHistory(UUID patientId) {
		var tenant = TenantContextHolder.require();
		return sessionRepository.findByOrganizationIdAndSiteIdAndPatientIdOrderByStartedAtDesc(
				tenant.organizationId(), tenant.siteId(), patientId);
	}

	private String loadPatientContext(CopilotSession session) {
		var tenant = TenantContextHolder.require();
		var record = clinicalRecordRepository
				.findTopByOrganizationIdAndSiteIdAndPatientIdOrderByUpdatedAtDesc(
						tenant.organizationId(), tenant.siteId(), session.getPatientId());
		if (record.isEmpty()) {
			return "No prior clinical records available.";
		}
		ClinicalRecord cr = record.get();
		var sb = new StringBuilder();
		sb.append("Latest clinical record (updated: ").append(cr.getUpdatedAt()).append("):\n");
		var entries = cr.getEntries();
		int limit = Math.min(entries.size(), 10);
		for (int i = 0; i < limit; i++) {
			var e = entries.get(entries.size() - limit + i);
			sb.append("  [").append(e.type()).append("] ").append(e.note()).append('\n');
		}
		return sb.toString();
	}

	private List<String> parseSuggestions(String suggestionsJson) {
		if (suggestionsJson == null || suggestionsJson.isBlank() || suggestionsJson.equals("[]")) {
			return new ArrayList<>();
		}
		try {
			return objectMapper.readValue(suggestionsJson, new TypeReference<>() {});
		} catch (JsonProcessingException e) {
			log.warn("Could not parse suggestions JSON: {}", e.getMessage());
			return new ArrayList<>();
		}
	}

	private String buildCopilotSystemPrompt(String sessionType) {
		return """
				You are a clinical copilot assistant for healthcare professionals.
				Session type: %s.
				Provide concise, evidence-based suggestions.
				Always note that suggestions require professional verification.
				Do not provide definitive diagnoses.
				Format suggestions as clear, actionable items.
				""".formatted(sessionType);
	}

	private String generateTemplateSuggestion(String sessionType, String context) {
		return switch (sessionType) {
			case "DENTAL_CONSULTATION" -> "Based on the clinical observation, consider: "
					+ "1) Complete radiographic evaluation, "
					+ "2) Periodontal assessment, "
					+ "3) Review patient history for contraindications. "
					+ "Context noted: " + truncate(context, 100);
			case "PSYCHOLOGICAL_SESSION" -> "Based on the session input, consider: "
					+ "1) Assess current emotional state using validated scales, "
					+ "2) Review progress on therapeutic goals, "
					+ "3) Evaluate coping strategies effectiveness. "
					+ "Context noted: " + truncate(context, 100);
			default -> "Based on the clinical context, consider: "
					+ "1) Review patient history thoroughly, "
					+ "2) Document key findings, "
					+ "3) Plan appropriate follow-up. "
					+ "Context noted: " + truncate(context, 100);
		};
	}

	private static String truncate(String text, int maxLen) {
		if (text == null) return "";
		return text.length() <= maxLen ? text : text.substring(0, maxLen) + "...";
	}
}

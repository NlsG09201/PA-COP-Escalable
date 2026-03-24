package com.COP_Escalable.Backend.copilot.api;

import com.COP_Escalable.Backend.copilot.application.CopilotService;
import com.COP_Escalable.Backend.copilot.domain.CopilotSession;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/copilot")
public class CopilotController {

	private final CopilotService copilotService;

	public CopilotController(CopilotService copilotService) {
		this.copilotService = copilotService;
	}

	@PostMapping("/patients/{patientId}/start")
	public CopilotSession startSession(@PathVariable UUID patientId,
									   @RequestBody StartSessionRequest body,
									   JwtAuthenticationToken auth) {
		UUID professionalId = UUID.fromString(auth.getToken().getClaimAsString("user_id"));
		return copilotService.startSession(patientId, professionalId, body.sessionType());
	}

	@PostMapping("/sessions/{sessionId}/suggest")
	public Map<String, String> suggest(@PathVariable UUID sessionId,
									   @RequestBody SuggestRequest body) {
		String suggestion = copilotService.generateSuggestion(sessionId, body.context());
		return Map.of("suggestion", suggestion);
	}

	@PostMapping("/sessions/{sessionId}/summarize")
	public Map<String, String> summarize(@PathVariable UUID sessionId) {
		String summary = copilotService.generateSummary(sessionId);
		return Map.of("summary", summary);
	}

	@PostMapping("/sessions/{sessionId}/end")
	public CopilotSession endSession(@PathVariable UUID sessionId) {
		return copilotService.endSession(sessionId);
	}

	@GetMapping("/professionals/{professionalId}/active")
	public List<CopilotSession> getActiveSessions(@PathVariable UUID professionalId) {
		return copilotService.getActiveSessions(professionalId);
	}

	@GetMapping("/patients/{patientId}/history")
	public List<CopilotSession> getSessionHistory(@PathVariable UUID patientId) {
		return copilotService.getSessionHistory(patientId);
	}

	public record StartSessionRequest(String sessionType) {}
	public record SuggestRequest(String context) {}
}

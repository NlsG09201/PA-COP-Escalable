package com.COP_Escalable.Backend.decisions.api;

import com.COP_Escalable.Backend.decisions.application.DecisionService;
import com.COP_Escalable.Backend.decisions.domain.ClinicalDecision;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/decisions")
public class DecisionsController {

	private final DecisionService decisionService;

	public DecisionsController(DecisionService decisionService) {
		this.decisionService = decisionService;
	}

	@PostMapping("/patients/{patientId}/recommend")
	public ClinicalDecision recommend(@PathVariable UUID patientId,
									  @RequestBody RecommendRequest body) {
		return decisionService.generateRecommendation(patientId, body.decisionType(), body.context());
	}

	@PutMapping("/{decisionId}/accept")
	public ClinicalDecision acceptDecision(@PathVariable UUID decisionId,
										   JwtAuthenticationToken auth) {
		UUID userId = UUID.fromString(auth.getToken().getClaimAsString("user_id"));
		return decisionService.acceptDecision(decisionId, userId);
	}

	@GetMapping("/patients/{patientId}")
	public List<ClinicalDecision> getPatientDecisions(@PathVariable UUID patientId) {
		return decisionService.getPatientDecisions(patientId);
	}

	@GetMapping("/site/stats")
	public Map<String, Object> getSiteStats() {
		return decisionService.getSiteDecisionStats();
	}

	public record RecommendRequest(String decisionType, Map<String, Object> context) {}
}

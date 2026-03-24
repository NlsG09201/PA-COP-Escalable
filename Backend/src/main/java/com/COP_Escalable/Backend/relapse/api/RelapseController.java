package com.COP_Escalable.Backend.relapse.api;

import com.COP_Escalable.Backend.relapse.application.RelapseService;
import com.COP_Escalable.Backend.relapse.domain.RelapseAlert;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@RestController
@RequestMapping("/api/relapse")
public class RelapseController {

	private final RelapseService relapseService;

	public RelapseController(RelapseService relapseService) {
		this.relapseService = relapseService;
	}

	@PostMapping("/patients/{patientId}/assess")
	public RelapseAlert assessRisk(@PathVariable UUID patientId) {
		return relapseService.assessRisk(patientId);
	}

	@GetMapping("/patients/{patientId}/risk")
	public RelapseAlert getLatestRisk(@PathVariable UUID patientId) {
		return relapseService.getLatestRisk(patientId)
				.orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "No risk assessment found"));
	}

	@GetMapping("/patients/{patientId}/trend")
	public List<RelapseAlert> getRiskTrend(@PathVariable UUID patientId) {
		return relapseService.getRiskTrend(patientId);
	}

	@PutMapping("/alerts/{alertId}/acknowledge")
	public RelapseAlert acknowledgeAlert(@PathVariable UUID alertId, JwtAuthenticationToken auth) {
		UUID userId = UUID.fromString(auth.getToken().getClaimAsString("user_id"));
		return relapseService.acknowledgeAlert(alertId, userId);
	}
}

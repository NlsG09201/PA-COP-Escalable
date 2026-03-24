package com.COP_Escalable.Backend.portal.api;

import com.COP_Escalable.Backend.portal.application.PortalDashboardResponse;
import com.COP_Escalable.Backend.portal.application.PortalService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/portal")
public class PortalController {

	private static final String PORTAL_PATIENT_ATTR = "portal.patientId";

	private final PortalService portalService;

	public PortalController(PortalService portalService) {
		this.portalService = portalService;
	}

	@PostMapping("/tokens/generate")
	public Map<String, String> generateToken(@RequestBody GenerateTokenRequest body) {
		String rawToken = portalService.generateAccessToken(body.patientId());
		return Map.of("token", rawToken);
	}

	@PostMapping("/auth")
	public Map<String, Object> authenticate(@RequestBody AuthRequest body,
											HttpServletRequest request) {
		UUID patientId = portalService.validateToken(body.token());
		request.getSession().setAttribute(PORTAL_PATIENT_ATTR, patientId);
		return Map.of("authenticated", true, "patientId", patientId);
	}

	@GetMapping("/dashboard")
	public PortalDashboardResponse getDashboard(HttpServletRequest request) {
		UUID patientId = resolvePatientId(request);
		return portalService.getPatientDashboard(patientId);
	}

	@GetMapping("/timeline")
	public List<PortalDashboardResponse.EntryView> getTimeline(HttpServletRequest request) {
		UUID patientId = resolvePatientId(request);
		return portalService.getPatientTimeline(patientId);
	}

	@GetMapping("/treatments")
	public List<PortalDashboardResponse.TreatmentPlanView> getTreatments(HttpServletRequest request) {
		UUID patientId = resolvePatientId(request);
		var dashboard = portalService.getPatientDashboard(patientId);
		return dashboard.activeTreatmentPlans();
	}

	@GetMapping("/appointments")
	public List<PortalDashboardResponse.AppointmentView> getAppointments(HttpServletRequest request) {
		UUID patientId = resolvePatientId(request);
		var dashboard = portalService.getPatientDashboard(patientId);
		return dashboard.upcomingAppointments();
	}

	@GetMapping("/therapy/progress")
	public PortalDashboardResponse.PsychologicalEvolutionView getTherapyProgress(HttpServletRequest request) {
		UUID patientId = resolvePatientId(request);
		var dashboard = portalService.getPatientDashboard(patientId);
		return dashboard.psychologicalEvolution();
	}

	private UUID resolvePatientId(HttpServletRequest request) {
		Object attr = request.getSession(false) != null
				? request.getSession(false).getAttribute(PORTAL_PATIENT_ATTR) : null;
		if (attr instanceof UUID patientId) {
			return patientId;
		}
		String authHeader = request.getHeader("X-Portal-Token");
		if (authHeader != null && !authHeader.isBlank()) {
			return portalService.validateToken(authHeader);
		}
		throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Portal authentication required");
	}

	public record GenerateTokenRequest(UUID patientId) {}
	public record AuthRequest(String token) {}
}

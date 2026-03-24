package com.COP_Escalable.Backend.therapy.api;

import com.COP_Escalable.Backend.therapy.application.TherapyAdaptationEngine;
import com.COP_Escalable.Backend.therapy.application.TherapyService;
import com.COP_Escalable.Backend.therapy.domain.TherapyModuleEntity;
import com.COP_Escalable.Backend.therapy.domain.TherapySession;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/therapy")
public class TherapyController {

	private final TherapyService service;
	private final TherapyAdaptationEngine adaptationEngine;

	public TherapyController(TherapyService service, TherapyAdaptationEngine adaptationEngine) {
		this.service = service;
		this.adaptationEngine = adaptationEngine;
	}

	@GetMapping("/modules")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL','PATIENT')")
	public List<TherapyModuleEntity> listModules(
			@RequestParam(required = false) String category) {
		return service.getAvailableModules(category);
	}

	@PostMapping("/patients/{patientId}/sessions/start")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL','PATIENT')")
	public TherapySession startSession(@PathVariable UUID patientId,
									   @RequestBody StartSessionRequest request) {
		return service.startSession(patientId, request.moduleId());
	}

	@PostMapping("/sessions/{sessionId}/complete")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL','PATIENT')")
	public TherapySession completeSession(@PathVariable UUID sessionId,
										  @RequestBody Map<String, Object> responses) {
		return service.completeExercise(sessionId, responses);
	}

	@PostMapping("/sessions/{sessionId}/abandon")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL','PATIENT')")
	public TherapySession abandonSession(@PathVariable UUID sessionId) {
		return service.abandonSession(sessionId);
	}

	@GetMapping("/patients/{patientId}/sessions")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public List<TherapySession> listSessions(@PathVariable UUID patientId) {
		return service.getPatientSessions(patientId);
	}

	@GetMapping("/patients/{patientId}/progress")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL','PATIENT')")
	public TherapyService.PatientProgress getProgress(@PathVariable UUID patientId) {
		return service.getPatientProgress(patientId);
	}

	@GetMapping("/patients/{patientId}/recommend")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL','PATIENT')")
	public TherapyModuleEntity recommend(@PathVariable UUID patientId) {
		return adaptationEngine.recommendNextExercise(patientId);
	}

	public record StartSessionRequest(UUID moduleId) {}
}

package com.COP_Escalable.Backend.followup.api;

import com.COP_Escalable.Backend.followup.application.FollowupService;
import com.COP_Escalable.Backend.followup.application.QuestionAnswer;
import com.COP_Escalable.Backend.followup.domain.FollowupSchedule;
import com.COP_Escalable.Backend.followup.domain.FollowupSurvey;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/followup")
public class FollowupController {

	private final FollowupService service;

	public FollowupController(FollowupService service) {
		this.service = service;
	}

	@GetMapping("/patients/{patientId}/surveys")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public List<FollowupSurvey> listSurveys(@PathVariable UUID patientId) {
		return service.getPatientSurveys(patientId);
	}

	@PostMapping("/patients/{patientId}/generate")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public FollowupSurvey generate(@PathVariable UUID patientId,
								   @RequestBody GenerateSurveyRequest request) {
		return service.generateSurvey(patientId, request.treatmentType(), request.triggerEvent());
	}

	@PostMapping("/surveys/{surveyId}/complete")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL','PATIENT')")
	public FollowupSurvey complete(@PathVariable UUID surveyId,
								   @RequestBody List<QuestionAnswer> answers) {
		return service.completeSurvey(surveyId, answers);
	}

	@GetMapping("/patients/{patientId}/schedules")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public List<FollowupSchedule> listSchedules(@PathVariable UUID patientId) {
		return service.getPatientSchedules(patientId);
	}

	public record GenerateSurveyRequest(String treatmentType, String triggerEvent) {}
}

package com.COP_Escalable.Backend.experience.api;

import com.COP_Escalable.Backend.experience.application.ExperienceService;
import com.COP_Escalable.Backend.experience.domain.ChurnPrediction;
import com.COP_Escalable.Backend.experience.domain.SatisfactionSurvey;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/experience")
public class ExperienceController {

	private final ExperienceService experienceService;

	public ExperienceController(ExperienceService experienceService) {
		this.experienceService = experienceService;
	}

	@PostMapping("/patients/{patientId}/nps-survey")
	public SatisfactionSurvey createNpsSurvey(@PathVariable UUID patientId,
											  @RequestBody CreateSurveyRequest body) {
		return experienceService.sendNpsSurvey(patientId, body.triggerEvent());
	}

	@PostMapping("/surveys/{surveyId}/complete")
	public SatisfactionSurvey completeSurvey(@PathVariable UUID surveyId,
											 @RequestBody CompleteSurveyRequest body) {
		return experienceService.completeNpsSurvey(surveyId, body.npsScore(), body.feedback());
	}

	@GetMapping("/patients/{patientId}")
	public Map<String, Object> getPatientExperience(@PathVariable UUID patientId) {
		return experienceService.getPatientExperience(patientId);
	}

	@GetMapping("/site/metrics")
	public Map<String, Object> getSiteMetrics() {
		return experienceService.getSiteMetrics();
	}

	@PostMapping("/patients/{patientId}/predict-churn")
	public ChurnPrediction predictChurn(@PathVariable UUID patientId) {
		return experienceService.predictChurn(patientId);
	}

	public record CreateSurveyRequest(String triggerEvent) {}
	public record CompleteSurveyRequest(int npsScore, String feedback) {}
}

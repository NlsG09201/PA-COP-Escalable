package com.COP_Escalable.Backend.personalization.api;

import com.COP_Escalable.Backend.personalization.application.PersonalizationService;
import com.COP_Escalable.Backend.personalization.domain.PatientPreferenceProfile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/personalization")
public class PersonalizationController {

	private final PersonalizationService personalizationService;

	public PersonalizationController(PersonalizationService personalizationService) {
		this.personalizationService = personalizationService;
	}

	@GetMapping("/patients/{patientId}/profile")
	public PatientPreferenceProfile getProfile(@PathVariable UUID patientId) {
		return personalizationService.getProfile(patientId);
	}

	@PostMapping("/patients/{patientId}/calculate")
	public PatientPreferenceProfile calculateProfile(@PathVariable UUID patientId) {
		return personalizationService.calculateProfile(patientId);
	}

	@GetMapping("/patients/{patientId}/recommendations")
	public Map<String, Object> getRecommendations(@PathVariable UUID patientId) {
		return personalizationService.getPersonalizedRecommendations(patientId);
	}
}

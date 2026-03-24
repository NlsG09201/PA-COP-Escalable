package com.COP_Escalable.Backend.aiassist.api;

import com.COP_Escalable.Backend.aiassist.application.AiAssistService;
import com.COP_Escalable.Backend.aiassist.domain.AiClinicalSuggestion;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@RestController
@RequestMapping("/api/ai-assist")
public class AiAssistController {

	private final AiAssistService service;

	public AiAssistController(AiAssistService service) {
		this.service = service;
	}

	@PostMapping("/patients/{patientId}/psych-tests/submissions/{submissionId}/analyze")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public ResponseEntity<AiClinicalSuggestion> analyzePsychSubmission(
			@PathVariable UUID patientId,
			@PathVariable UUID submissionId,
			@AuthenticationPrincipal Jwt jwt,
			@RequestParam(name = "sync", defaultValue = "false") boolean sync
	) {
		try {
			if (!sync && service.useAsyncAnalyzeByDefault()) {
				return ResponseEntity.status(HttpStatus.ACCEPTED).body(service.enqueuePsychTestAnalysis(patientId, submissionId, jwt));
			}
			return ResponseEntity.ok(service.analyzePsychTestSubmissionSync(patientId, submissionId, jwt));
		} catch (IllegalStateException e) {
			throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
		}
	}

	@GetMapping("/patients/{patientId}/suggestions/latest")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public AiClinicalSuggestion latest(@PathVariable UUID patientId) {
		try {
			return service.latestForPatient(patientId);
		} catch (IllegalArgumentException e) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
		}
	}

	@GetMapping("/patients/{patientId}/suggestions/{suggestionId}")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public AiClinicalSuggestion getOne(
			@PathVariable UUID patientId,
			@PathVariable UUID suggestionId
	) {
		try {
			return service.getSuggestion(patientId, suggestionId);
		} catch (IllegalArgumentException e) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
		}
	}

	@PostMapping("/suggestions/{suggestionId}/approve")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public AiClinicalSuggestion approve(
			@PathVariable UUID suggestionId,
			@AuthenticationPrincipal Jwt jwt,
			@Valid @RequestBody(required = false) ReviewBody body
	) {
		try {
			String note = body != null ? body.note() : null;
			return service.approve(suggestionId, jwt, note);
		} catch (IllegalArgumentException e) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
		} catch (IllegalStateException e) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
		}
	}

	@PostMapping("/suggestions/{suggestionId}/reject")
	@ResponseStatus(HttpStatus.OK)
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public AiClinicalSuggestion reject(
			@PathVariable UUID suggestionId,
			@AuthenticationPrincipal Jwt jwt,
			@Valid @RequestBody(required = false) ReviewBody body
	) {
		try {
			String reason = body != null ? body.reason() : null;
			return service.reject(suggestionId, jwt, reason);
		} catch (IllegalArgumentException e) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
		} catch (IllegalStateException e) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
		}
	}

	public record ReviewBody(String note, String reason) {}
}

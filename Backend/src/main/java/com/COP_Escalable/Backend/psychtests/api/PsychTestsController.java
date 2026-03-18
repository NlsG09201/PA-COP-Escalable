package com.COP_Escalable.Backend.psychtests.api;

import com.COP_Escalable.Backend.iam.service.CopUserPrincipal;
import com.COP_Escalable.Backend.psychtests.application.PsychTestsService;
import com.COP_Escalable.Backend.psychtests.domain.TestSubmission;
import com.COP_Escalable.Backend.psychtests.domain.TestTemplate;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/psych-tests")
public class PsychTestsController {
	private final PsychTestsService service;

	public PsychTestsController(PsychTestsService service) {
		this.service = service;
	}

	@GetMapping("/templates")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL','PATIENT')")
	public List<TestTemplate> templates() {
		return service.listTemplates();
	}

	@PostMapping("/templates")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public TestTemplate create(@Valid @RequestBody CreateTemplateRequest req) {
		return service.createTemplate(req.code(), req.name(), req.questions());
	}

	@GetMapping("/patients/{patientId}/submissions")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public List<TestSubmission> submissions(@PathVariable UUID patientId) {
		return service.listSubmissions(patientId);
	}

	@PostMapping("/patients/{patientId}/submissions")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL','PATIENT')")
	public TestSubmission submit(
			@PathVariable UUID patientId,
			@AuthenticationPrincipal CopUserPrincipal principal,
			@Valid @RequestBody SubmitRequest req
	) {
		return service.submit(patientId, req.templateId(), principal, req.answersByQuestionId());
	}

	public record CreateTemplateRequest(
			@NotBlank String code,
			@NotBlank String name,
			@NotEmpty List<TestTemplate.Question> questions
	) {}

	public record SubmitRequest(
			@NotNull UUID templateId,
			@NotEmpty Map<String, String> answersByQuestionId
	) {}
}


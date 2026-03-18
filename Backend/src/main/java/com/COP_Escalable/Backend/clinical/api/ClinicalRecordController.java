package com.COP_Escalable.Backend.clinical.api;

import com.COP_Escalable.Backend.clinical.application.ClinicalRecordService;
import com.COP_Escalable.Backend.clinical.domain.ClinicalRecord;
import com.COP_Escalable.Backend.iam.service.CopUserPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/clinical")
public class ClinicalRecordController {
	private final ClinicalRecordService service;

	public ClinicalRecordController(ClinicalRecordService service) {
		this.service = service;
	}

	@GetMapping("/records/{patientId}")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public ClinicalRecord record(@PathVariable UUID patientId) {
		return service.getOrCreateFor(patientId);
	}

	@PostMapping("/records/{patientId}/entries")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public ClinicalRecord addEntry(
			@PathVariable UUID patientId,
			@AuthenticationPrincipal CopUserPrincipal principal,
			@Valid @RequestBody AddEntryRequest req
	) {
		return service.addEntry(patientId, principal, req.type(), req.note());
	}

	public record AddEntryRequest(
			@NotBlank String type,
			@NotBlank String note
	) {}
}


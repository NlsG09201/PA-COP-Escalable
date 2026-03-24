package com.COP_Escalable.Backend.clinical.api;

import com.COP_Escalable.Backend.clinical.application.ClinicalRecordService;
import com.COP_Escalable.Backend.clinical.domain.ClinicalRecord;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
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
			@AuthenticationPrincipal Jwt jwt,
			@Valid @RequestBody AddEntryRequest req
	) {
		String userIdClaim = jwt != null ? jwt.getClaimAsString("user_id") : null;
		if (userIdClaim == null || userIdClaim.isBlank()) {
			throw new IllegalArgumentException("Missing user_id claim");
		}

		String username = jwt.getSubject();
		if (username == null || username.isBlank()) {
			throw new IllegalArgumentException("Missing subject claim");
		}

		return service.addEntry(patientId, UUID.fromString(userIdClaim), username, req.type(), req.note());
	}

	@PostMapping("/records/{patientId}/alerts")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','PROFESSIONAL')")
	public ClinicalRecord createMedicalAlert(
			@PathVariable UUID patientId,
			@AuthenticationPrincipal Jwt jwt,
			@Valid @RequestBody AddMedicalAlertRequest req
	) {
		String userIdClaim = jwt != null ? jwt.getClaimAsString("user_id") : null;
		if (userIdClaim == null || userIdClaim.isBlank()) {
			throw new IllegalArgumentException("Missing user_id claim");
		}

		String username = jwt.getSubject();
		if (username == null || username.isBlank()) {
			throw new IllegalArgumentException("Missing subject claim");
		}

		return service.createMedicalAlert(
				patientId,
				UUID.fromString(userIdClaim),
				username,
				req.title(),
				req.message(),
				req.severity()
		);
	}

	public record AddEntryRequest(
			@NotBlank String type,
			@NotBlank String note
	) {}

	public record AddMedicalAlertRequest(
			@NotBlank String title,
			@NotBlank String message,
			String severity
	) {}
}


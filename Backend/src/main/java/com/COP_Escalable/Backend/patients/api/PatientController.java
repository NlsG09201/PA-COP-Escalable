package com.COP_Escalable.Backend.patients.api;

import com.COP_Escalable.Backend.patients.application.PatientService;
import com.COP_Escalable.Backend.patients.domain.Patient;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/patients")
public class PatientController {
	private final PatientService service;

	public PatientController(PatientService service) {
		this.service = service;
	}

	@GetMapping
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL')")
	public List<Patient> list() {
		return service.listForCurrentSite();
	}

	@GetMapping("/{id}")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL')")
	public Patient get(@PathVariable UUID id) {
		return service.requireById(id);
	}

	@PostMapping
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL')")
	public Patient create(@Valid @RequestBody CreatePatientRequest req) {
		return service.create(req.externalCode(), req.fullName(), req.birthDate(), req.phone(), req.email());
	}

	public record CreatePatientRequest(
			String externalCode,
			@NotBlank String fullName,
			LocalDate birthDate,
			String phone,
			String email
	) {}
}


package com.COP_Escalable.Backend.appointments.api;

import com.COP_Escalable.Backend.appointments.application.AppointmentService;
import com.COP_Escalable.Backend.appointments.domain.Appointment;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {
	private final AppointmentService service;

	public AppointmentController(AppointmentService service) {
		this.service = service;
	}

	@GetMapping
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL')")
	public List<Appointment> list(
			@RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
			@RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to
	) {
		return service.list(from, to);
	}

	@PostMapping
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL','PACIENTE','PATIENT')")
	public Appointment request(@Valid @RequestBody RequestAppointment req) {
		return service.request(req.professionalId(), req.patientId(), req.startAt(), req.endAt(), req.reason());
	}

	public record RequestAppointment(
			@NotNull UUID professionalId,
			@NotNull UUID patientId,
			@NotNull Instant startAt,
			@NotNull Instant endAt,
			String reason
	) {}
}


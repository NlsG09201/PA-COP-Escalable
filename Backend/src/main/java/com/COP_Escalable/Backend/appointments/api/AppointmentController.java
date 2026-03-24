package com.COP_Escalable.Backend.appointments.api;

import com.COP_Escalable.Backend.appointments.application.AppointmentService;
import com.COP_Escalable.Backend.appointments.application.AppointmentService.AppointmentPage;
import com.COP_Escalable.Backend.appointments.application.SmartAssignmentService;
import com.COP_Escalable.Backend.appointments.domain.Appointment;
import com.COP_Escalable.Backend.appointments.domain.AppointmentStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
	private final SmartAssignmentService smartAssignment;

	public AppointmentController(AppointmentService service, SmartAssignmentService smartAssignment) {
		this.service = service;
		this.smartAssignment = smartAssignment;
	}

	@GetMapping
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL')")
	public List<Appointment> list(
			@RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
			@RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
			@RequestParam(defaultValue = "1000") int limit
	) {
		return service.list(from, to, limit);
	}

	@GetMapping("/page")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL')")
	public AppointmentPage listPage(
			@RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
			@RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "50") int size,
			@RequestParam(required = false) UUID professionalId,
			@RequestParam(required = false) AppointmentStatus status
	) {
		return service.listPageFiltered(from, to, page, size, professionalId, status);
	}

	@PostMapping
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL','PACIENTE','PATIENT')")
	public Appointment request(@Valid @RequestBody RequestAppointment req) {
		return service.request(
				req.professionalId(),
				req.patientId(),
				req.startAt(),
				req.endAt(),
				req.reason(),
				req.serviceOfferingId(),
				req.serviceNameSnapshot(),
				req.serviceCategorySnapshot()
		);
	}

	@PostMapping("/{appointmentId}/confirm")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL')")
	public Appointment confirm(@PathVariable UUID appointmentId) {
		return service.confirm(appointmentId);
	}

	@PostMapping("/{appointmentId}/cancel")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL','PACIENTE','PATIENT')")
	public Appointment cancel(@PathVariable UUID appointmentId) {
		return service.cancel(appointmentId);
	}

	@PostMapping("/assignments/recommend")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL')")
	public SmartAssignmentService.AssignmentRecommendation recommend(@Valid @RequestBody AssignmentRequest req) {
		return smartAssignment.recommend(req.toCommand());
	}

	@PostMapping("/assignments/auto-request")
	@PreAuthorize("hasAnyRole('ADMIN','MEDICO','ORG_ADMIN','SITE_ADMIN','PROFESSIONAL')")
	public Appointment autoRequest(@Valid @RequestBody AssignmentRequest req) {
		return smartAssignment.autoAssignAndRequest(req.toCommand());
	}

	public record RequestAppointment(
			@NotNull UUID professionalId,
			@NotNull UUID patientId,
			@NotNull Instant startAt,
			@NotNull Instant endAt,
			String reason,
			UUID serviceOfferingId,
			String serviceNameSnapshot,
			String serviceCategorySnapshot
	) {}

	public record AssignmentRequest(
			@NotNull UUID patientId,
			@NotNull SmartAssignmentService.AppointmentType appointmentType,
			@NotNull Instant startAt,
			@NotNull Instant endAt,
			@NotNull SmartAssignmentService.AppointmentPriority priority,
			UUID preferredProfessionalId,
			String reason,
			UUID serviceOfferingId,
			String serviceNameSnapshot,
			String serviceCategorySnapshot
	) {
		public SmartAssignmentService.AssignmentRequest toCommand() {
			return new SmartAssignmentService.AssignmentRequest(
					patientId,
					appointmentType,
					startAt,
					endAt,
					priority,
					preferredProfessionalId,
					reason,
					serviceOfferingId,
					serviceNameSnapshot,
					serviceCategorySnapshot
			);
		}
	}
}


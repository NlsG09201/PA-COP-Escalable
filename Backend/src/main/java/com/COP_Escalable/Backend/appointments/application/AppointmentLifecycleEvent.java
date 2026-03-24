package com.COP_Escalable.Backend.appointments.application;

import com.COP_Escalable.Backend.appointments.domain.Appointment;

import java.time.Instant;
import java.util.UUID;

public record AppointmentLifecycleEvent(
		UUID organizationId,
		UUID siteId,
		UUID appointmentId,
		UUID patientId,
		UUID professionalId,
		AppointmentEventType eventType,
		Instant startAt,
		Instant endAt,
		String reason,
		Instant occurredAt
) {
	public static AppointmentLifecycleEvent created(Appointment appointment) {
		return new AppointmentLifecycleEvent(
				appointment.getOrganizationId(),
				appointment.getSiteId(),
				appointment.getId(),
				appointment.getPatientId(),
				appointment.getProfessionalId(),
				AppointmentEventType.CITA_CREADA,
				appointment.getStartAt(),
				appointment.getEndAt(),
				appointment.getReason(),
				Instant.now()
		);
	}

	public static AppointmentLifecycleEvent confirmed(Appointment appointment) {
		return new AppointmentLifecycleEvent(
				appointment.getOrganizationId(),
				appointment.getSiteId(),
				appointment.getId(),
				appointment.getPatientId(),
				appointment.getProfessionalId(),
				AppointmentEventType.CITA_CONFIRMADA,
				appointment.getStartAt(),
				appointment.getEndAt(),
				appointment.getReason(),
				Instant.now()
		);
	}

	public static AppointmentLifecycleEvent cancelled(Appointment appointment) {
		return new AppointmentLifecycleEvent(
				appointment.getOrganizationId(),
				appointment.getSiteId(),
				appointment.getId(),
				appointment.getPatientId(),
				appointment.getProfessionalId(),
				AppointmentEventType.CITA_CANCELADA,
				appointment.getStartAt(),
				appointment.getEndAt(),
				appointment.getReason(),
				Instant.now()
		);
	}
}

package com.COP_Escalable.Backend.appointments.application;

import com.COP_Escalable.Backend.appointments.domain.Appointment;
import com.COP_Escalable.Backend.appointments.infrastructure.AppointmentRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class AppointmentService {
	private final AppointmentRepository appointments;
	private final ApplicationEventPublisher eventPublisher;

	public AppointmentService(AppointmentRepository appointments, ApplicationEventPublisher eventPublisher) {
		this.appointments = appointments;
		this.eventPublisher = eventPublisher;
	}

	@Transactional(readOnly = true)
	public List<Appointment> list(Instant from, Instant to) {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) throw new IllegalArgumentException("site_id is required in tenant context");
		if (from == null || to == null) throw new IllegalArgumentException("from/to are required");
		return appointments.findAllByOrganizationIdAndSiteIdAndStartAtBetween(ctx.organizationId(), ctx.siteId(), from, to);
	}

	@Transactional
	public Appointment request(UUID professionalId, UUID patientId, Instant startAt, Instant endAt, String reason) {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) throw new IllegalArgumentException("site_id is required in tenant context");
		boolean overlap = appointments.existsOverlapping(ctx.organizationId(), ctx.siteId(), professionalId, startAt, endAt);
		if (overlap) {
			throw new IllegalArgumentException("Overlapping appointment for professional");
		}
		var appt = Appointment.request(ctx.organizationId(), ctx.siteId(), professionalId, patientId, startAt, endAt, reason);
		var saved = appointments.save(appt);
		eventPublisher.publishEvent(AppointmentLifecycleEvent.created(saved));
		return saved;
	}

	@Transactional
	public Appointment confirm(UUID appointmentId) {
		var appointment = loadAppointmentForCurrentTenant(appointmentId);
		appointment.confirm();
		var saved = appointments.save(appointment);
		eventPublisher.publishEvent(AppointmentLifecycleEvent.confirmed(saved));
		return saved;
	}

	@Transactional
	public Appointment cancel(UUID appointmentId) {
		var appointment = loadAppointmentForCurrentTenant(appointmentId);
		appointment.cancel();
		var saved = appointments.save(appointment);
		eventPublisher.publishEvent(AppointmentLifecycleEvent.cancelled(saved));
		return saved;
	}

	private Appointment loadAppointmentForCurrentTenant(UUID appointmentId) {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) throw new IllegalArgumentException("site_id is required in tenant context");
		if (appointmentId == null) throw new IllegalArgumentException("appointmentId is required");
		return appointments.findByIdAndOrganizationIdAndSiteId(appointmentId, ctx.organizationId(), ctx.siteId())
				.orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
	}
}


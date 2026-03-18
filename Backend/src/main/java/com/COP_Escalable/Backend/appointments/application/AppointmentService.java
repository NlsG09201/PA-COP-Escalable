package com.COP_Escalable.Backend.appointments.application;

import com.COP_Escalable.Backend.appointments.domain.Appointment;
import com.COP_Escalable.Backend.appointments.infrastructure.AppointmentRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class AppointmentService {
	private final AppointmentRepository appointments;

	public AppointmentService(AppointmentRepository appointments) {
		this.appointments = appointments;
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
		return appointments.save(appt);
	}
}


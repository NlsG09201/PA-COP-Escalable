package com.COP_Escalable.Backend.appointments.application;

import com.COP_Escalable.Backend.appointments.domain.Appointment;
import com.COP_Escalable.Backend.appointments.domain.AppointmentStatus;
import com.COP_Escalable.Backend.appointments.infrastructure.AppointmentRepository;
import com.COP_Escalable.Backend.shared.tenancy.TenantContextHolder;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
		return list(from, to, 1000);
	}

	@Transactional(readOnly = true)
	public List<Appointment> list(Instant from, Instant to, int limit) {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) throw new IllegalArgumentException("site_id is required in tenant context");
		if (from == null || to == null) throw new IllegalArgumentException("from/to are required");
		int bounded = Math.max(1, Math.min(limit, 5000));
		return appointments.findAllByOrganizationIdAndSiteIdAndStartAtBetweenOrderByStartAtAsc(
				ctx.organizationId(),
				ctx.siteId(),
				from,
				to,
				PageRequest.of(0, bounded)
		);
	}

	@Transactional(readOnly = true)
	public AppointmentPage listPage(Instant from, Instant to, int page, int size) {
		return listPageFiltered(from, to, page, size, null, null);
	}

	@Transactional(readOnly = true)
	public AppointmentPage listPageFiltered(
			Instant from,
			Instant to,
			int page,
			int size,
			UUID professionalId,
			AppointmentStatus status
	) {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) throw new IllegalArgumentException("site_id is required in tenant context");
		if (from == null || to == null) throw new IllegalArgumentException("from/to are required");
		int safePage = Math.max(0, page);
		int safeSize = Math.max(1, Math.min(size, 1000));
		var pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.ASC, "startAt"));
		var items = appointments.findPageWithFilters(
				ctx.organizationId(), ctx.siteId(), from, to, professionalId, status, pageable
		);
		long total = appointments.countWithFilters(
				ctx.organizationId(), ctx.siteId(), from, to, professionalId, status
		);
		return new AppointmentPage(items, safePage, safeSize, total, ((long) (safePage + 1) * safeSize) < total);
	}

	@Transactional
	public Appointment request(UUID professionalId, UUID patientId, Instant startAt, Instant endAt, String reason) {
		return request(professionalId, patientId, startAt, endAt, reason, null, null, null);
	}

	@Transactional
	public Appointment request(
			UUID professionalId,
			UUID patientId,
			Instant startAt,
			Instant endAt,
			String reason,
			UUID serviceOfferingId,
			String serviceNameSnapshot,
			String serviceCategorySnapshot
	) {
		var ctx = TenantContextHolder.require();
		if (ctx.siteId() == null) throw new IllegalArgumentException("site_id is required in tenant context");
		boolean overlap = appointments.existsOverlapping(ctx.organizationId(), ctx.siteId(), professionalId, startAt, endAt);
		if (overlap) {
			throw new IllegalArgumentException("Overlapping appointment for professional");
		}
		var appt = Appointment.request(
				ctx.organizationId(),
				ctx.siteId(),
				professionalId,
				patientId,
				startAt,
				endAt,
				reason,
				serviceOfferingId,
				serviceNameSnapshot,
				serviceCategorySnapshot
		);
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

	public record AppointmentPage(
			List<Appointment> items,
			int page,
			int size,
			long total,
			boolean hasNext
	) {}
}


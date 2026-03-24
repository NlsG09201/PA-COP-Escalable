package com.COP_Escalable.Backend.analytics.application;

import com.COP_Escalable.Backend.analytics.infrastructure.AnalyticsRollupRepository;
import com.COP_Escalable.Backend.appointments.application.AppointmentEventType;
import com.COP_Escalable.Backend.appointments.application.AppointmentLifecycleEvent;
import com.COP_Escalable.Backend.patients.application.PatientRegisteredEvent;
import com.COP_Escalable.Backend.publicbooking.application.PublicPaymentPaidEvent;
import com.COP_Escalable.Backend.tenancy.infrastructure.ProfessionalRepository;
import com.COP_Escalable.Backend.tenancy.infrastructure.SiteRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

@Component
public class AnalyticsProjectionListener {
	private final AnalyticsRollupRepository rollup;
	private final ProfessionalRepository professionals;
	private final SiteRepository sites;
	private final AnalyticsCacheService cache;

	public AnalyticsProjectionListener(
			AnalyticsRollupRepository rollup,
			ProfessionalRepository professionals,
			SiteRepository sites,
			AnalyticsCacheService cache
	) {
		this.rollup = rollup;
		this.professionals = professionals;
		this.sites = sites;
		this.cache = cache;
	}

	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void onAppointmentLifecycle(AppointmentLifecycleEvent event) {
		if (event.eventType() == AppointmentEventType.RECORDATORIO_CITA) {
			return;
		}
		var zone = resolveZone(event.organizationId(), event.siteId());
		var day = toLocalDate(event.startAt(), zone);
		var bookedMinutes = bookedMinutes(event.startAt(), event.endAt());
		var specialty = event.professionalId() == null
				? "_SIN_PROFESIONAL_"
				: resolveSpecialty(event.organizationId(), event.professionalId());

		long dCreated = 0;
		long dConfirmed = 0;
		long dCancelled = 0;
		switch (event.eventType()) {
			case CITA_CREADA -> dCreated = 1;
			case CITA_CONFIRMADA -> dConfirmed = 1;
			case CITA_CANCELADA -> dCancelled = 1;
			default -> {
				return;
			}
		}

		rollup.mergeSite(
				event.organizationId(),
				event.siteId(),
				day,
				dCreated,
				dConfirmed,
				dCancelled,
				0,
				0,
				0,
				dCreated == 1 ? bookedMinutes : 0
		);
		rollup.mergeSpecialty(
				event.organizationId(),
				event.siteId(),
				day,
				specialty,
				dCreated,
				dConfirmed,
				dCancelled,
				0L,
				0L,
				dCreated == 1 ? bookedMinutes : 0L
		);
		if (event.professionalId() != null) {
			rollup.mergeProfessional(
					event.organizationId(),
					event.siteId(),
					day,
					event.professionalId(),
					dCreated,
					dConfirmed,
					dCancelled,
					0,
					0,
					dCreated == 1 ? bookedMinutes : 0
			);
		}
		cache.invalidateNamespace(event.organizationId() + ":" + event.siteId());
	}

	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void onPublicPaymentPaid(PublicPaymentPaidEvent event) {
		var zone = resolveZone(event.organizationId(), event.siteId());
		var appointmentDay = toLocalDate(event.appointmentStartAt(), zone);
		var paidDay = toLocalDate(event.paidAt(), zone);
		var bookedMinutes = bookedMinutes(event.appointmentStartAt(), event.appointmentEndAt());
		var specialty = event.professionalId() == null
				? "_SIN_PROFESIONAL_"
				: resolveSpecialty(event.organizationId(), event.professionalId());

		rollup.mergeSite(
				event.organizationId(),
				event.siteId(),
				appointmentDay,
				1,
				0,
				0,
				0,
				0,
				0,
				bookedMinutes
		);
		rollup.mergeSpecialty(
				event.organizationId(),
				event.siteId(),
				appointmentDay,
				specialty,
				1,
				0,
				0,
				0,
				0,
				bookedMinutes
		);
		if (event.professionalId() != null) {
			rollup.mergeProfessional(
					event.organizationId(),
					event.siteId(),
					appointmentDay,
					event.professionalId(),
					1,
					0,
					0,
					0,
					0,
					bookedMinutes
			);
		}

		rollup.mergeSite(
				event.organizationId(),
				event.siteId(),
				paidDay,
				0,
				0,
				0,
				0,
				0,
				event.amountCents(),
				0
		);
		rollup.mergeSpecialty(
				event.organizationId(),
				event.siteId(),
				paidDay,
				specialty,
				0,
				0,
				0,
				0,
				event.amountCents(),
				0
		);
		if (event.professionalId() != null) {
			rollup.mergeProfessional(
					event.organizationId(),
					event.siteId(),
					paidDay,
					event.professionalId(),
					0,
					0,
					0,
					0,
					event.amountCents(),
					0
			);
		}
		cache.invalidateNamespace(event.organizationId() + ":" + event.siteId());
	}

	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void onPatientRegistered(PatientRegisteredEvent event) {
		var zone = resolveZone(event.organizationId(), event.siteId());
		var day = toLocalDate(event.createdAt(), zone);
		rollup.mergeSite(event.organizationId(), event.siteId(), day, 0, 0, 0, 0, 1, 0, 0);
		cache.invalidateNamespace(event.organizationId() + ":" + event.siteId());
	}

	private ZoneId resolveZone(UUID organizationId, UUID siteId) {
		if (siteId == null) {
			return ZoneId.of("UTC");
		}
		var site = sites.findByIdAndOrganizationId(siteId, organizationId).orElse(null);
		if (site == null) {
			return ZoneId.of("UTC");
		}
		try {
			return ZoneId.of(site.getTimezone());
		} catch (Exception ex) {
			return ZoneId.of("UTC");
		}
	}

	private static LocalDate toLocalDate(Instant instant, ZoneId zone) {
		if (instant == null) {
			return LocalDate.now(zone);
		}
		return instant.atZone(zone).toLocalDate();
	}

	private static long bookedMinutes(Instant start, Instant end) {
		if (start == null || end == null || !end.isAfter(start)) {
			return 0;
		}
		return Math.max(0, Duration.between(start, end).toMinutes());
	}

	private String resolveSpecialty(UUID organizationId, UUID professionalId) {
		return professionals.findByIdAndOrganizationId(professionalId, organizationId)
				.map(p -> p.getSpecialty() == null || p.getSpecialty().isBlank() ? "_DESCONOCIDO_" : p.getSpecialty().trim())
				.orElse("_DESCONOCIDO_");
	}
}

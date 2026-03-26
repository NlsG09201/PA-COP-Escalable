package com.COP_Escalable.Backend.appointments.infrastructure;

import com.COP_Escalable.Backend.appointments.domain.Appointment;
import com.COP_Escalable.Backend.appointments.domain.AppointmentStatus;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface AppointmentRepositoryCustom {

	List<Appointment> findPageWithFilters(
			UUID organizationId,
			UUID siteId,
			Instant from,
			Instant to,
			UUID professionalId,
			AppointmentStatus status,
			Pageable pageable
	);

	long countWithFilters(
			UUID organizationId,
			UUID siteId,
			Instant from,
			Instant to,
			UUID professionalId,
			AppointmentStatus status
	);

	boolean existsOverlapping(UUID organizationId, UUID siteId, UUID professionalId, Instant startAt, Instant endAt);

	List<ProfessionalLoadRow> countLoadByProfessional(UUID organizationId, UUID siteId, Instant from, Instant to);

	long countProfessionalDayLoad(UUID organizationId, UUID siteId, UUID professionalId, Instant from, Instant to);
}

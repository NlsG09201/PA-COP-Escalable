package com.COP_Escalable.Backend.appointments.infrastructure;

import com.COP_Escalable.Backend.appointments.domain.Appointment;
import com.COP_Escalable.Backend.appointments.domain.AppointmentStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AppointmentRepository extends MongoRepository<Appointment, UUID>, AppointmentRepositoryCustom {

	List<Appointment> findAllByOrganizationIdAndSiteIdAndStartAtBetween(UUID organizationId, UUID siteId, Instant from, Instant to);

	List<Appointment> findAllByOrganizationIdAndSiteIdAndStartAtBetweenOrderByStartAtAsc(
			UUID organizationId,
			UUID siteId,
			Instant from,
			Instant to,
			Pageable pageable
	);

	long countByOrganizationIdAndSiteIdAndStartAtBetween(UUID organizationId, UUID siteId, Instant from, Instant to);

	Optional<Appointment> findByIdAndOrganizationIdAndSiteId(UUID id, UUID organizationId, UUID siteId);

	List<Appointment> findTop100ByStatusAndStartAtBetweenOrderByStartAtAsc(
			AppointmentStatus status,
			Instant from,
			Instant to
	);
}

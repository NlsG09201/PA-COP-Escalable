package com.COP_Escalable.Backend.appointments.infrastructure;

import com.COP_Escalable.Backend.appointments.domain.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {

	List<Appointment> findAllByOrganizationIdAndSiteIdAndStartAtBetween(UUID organizationId, UUID siteId, Instant from, Instant to);

	@Query("""
			select case when count(a) > 0 then true else false end
			from Appointment a
			where a.organizationId = :organizationId
			  and a.siteId = :siteId
			  and a.professionalId = :professionalId
			  and a.startAt < :endAt
			  and a.endAt > :startAt
			  and a.status in ('REQUESTED','CONFIRMED')
			""")
	boolean existsOverlapping(UUID organizationId, UUID siteId, UUID professionalId, Instant startAt, Instant endAt);
}


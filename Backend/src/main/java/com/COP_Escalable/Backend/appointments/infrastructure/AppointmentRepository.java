package com.COP_Escalable.Backend.appointments.infrastructure;

import com.COP_Escalable.Backend.appointments.domain.Appointment;
import com.COP_Escalable.Backend.appointments.domain.AppointmentStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {

	List<Appointment> findAllByOrganizationIdAndSiteIdAndStartAtBetween(UUID organizationId, UUID siteId, Instant from, Instant to);
	List<Appointment> findAllByOrganizationIdAndSiteIdAndStartAtBetweenOrderByStartAtAsc(
			UUID organizationId,
			UUID siteId,
			Instant from,
			Instant to,
			Pageable pageable
	);
	long countByOrganizationIdAndSiteIdAndStartAtBetween(UUID organizationId, UUID siteId, Instant from, Instant to);
	@Query("""
			select a
			from Appointment a
			where a.organizationId = :organizationId
			  and a.siteId = :siteId
			  and a.startAt >= :from
			  and a.startAt <= :to
			  and (:professionalId is null or a.professionalId = :professionalId)
			  and (:status is null or a.status = :status)
			order by a.startAt asc
			""")
	List<Appointment> findPageWithFilters(
			UUID organizationId,
			UUID siteId,
			Instant from,
			Instant to,
			UUID professionalId,
			AppointmentStatus status,
			Pageable pageable
	);
	@Query("""
			select count(a)
			from Appointment a
			where a.organizationId = :organizationId
			  and a.siteId = :siteId
			  and a.startAt >= :from
			  and a.startAt <= :to
			  and (:professionalId is null or a.professionalId = :professionalId)
			  and (:status is null or a.status = :status)
			""")
	long countWithFilters(
			UUID organizationId,
			UUID siteId,
			Instant from,
			Instant to,
			UUID professionalId,
			AppointmentStatus status
	);

	Optional<Appointment> findByIdAndOrganizationIdAndSiteId(UUID id, UUID organizationId, UUID siteId);

	List<Appointment> findTop100ByStatusAndStartAtBetweenOrderByStartAtAsc(
			AppointmentStatus status,
			Instant from,
			Instant to
	);

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

	@Query("""
			select new com.COP_Escalable.Backend.appointments.infrastructure.ProfessionalLoadRow(
			  a.professionalId,
			  count(a)
			)
			from Appointment a
			where a.organizationId = :organizationId
			  and a.siteId = :siteId
			  and a.startAt >= :from
			  and a.startAt <= :to
			  and a.status in ('REQUESTED','CONFIRMED')
			group by a.professionalId
			""")
	List<ProfessionalLoadRow> countLoadByProfessional(UUID organizationId, UUID siteId, Instant from, Instant to);

	@Query("""
			select count(a)
			from Appointment a
			where a.organizationId = :organizationId
			  and a.siteId = :siteId
			  and a.professionalId = :professionalId
			  and a.startAt >= :from
			  and a.startAt < :to
			  and a.status in ('REQUESTED','CONFIRMED')
			""")
	long countProfessionalDayLoad(UUID organizationId, UUID siteId, UUID professionalId, Instant from, Instant to);
}


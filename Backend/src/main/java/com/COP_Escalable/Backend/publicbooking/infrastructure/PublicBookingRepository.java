package com.COP_Escalable.Backend.publicbooking.infrastructure;

import com.COP_Escalable.Backend.publicbooking.domain.PublicBooking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface PublicBookingRepository extends JpaRepository<PublicBooking, UUID> {
	Optional<PublicBooking> findByIdAndOrganizationId(UUID id, UUID organizationId);

	@Query("""
			select case when count(b) > 0 then true else false end
			from PublicBooking b
			where b.organizationId = :organizationId
			  and b.siteId = :siteId
			  and b.professionalId = :professionalId
			  and b.appointmentStartAt < :endAt
			  and b.appointmentEndAt > :startAt
			  and (
			    b.status = 'CONFIRMED'
			    or (b.status = 'PENDING_PAYMENT' and b.expiresAt is not null and b.expiresAt > :now)
			  )
			""")
	boolean existsActiveOverlap(
			UUID organizationId,
			UUID siteId,
			UUID professionalId,
			Instant startAt,
			Instant endAt,
			Instant now
	);
}

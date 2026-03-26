package com.COP_Escalable.Backend.publicbooking.infrastructure;

import com.COP_Escalable.Backend.publicbooking.domain.PublicBooking;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;
import java.util.UUID;

public interface PublicBookingRepository extends MongoRepository<PublicBooking, UUID>, PublicBookingRepositoryCustom {
	Optional<PublicBooking> findByIdAndOrganizationId(UUID id, UUID organizationId);
}

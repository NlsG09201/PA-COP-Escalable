package com.COP_Escalable.Backend.publicbooking.infrastructure;

import com.COP_Escalable.Backend.publicbooking.domain.PublicPayment;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;
import java.util.UUID;

public interface PublicPaymentRepository extends MongoRepository<PublicPayment, UUID> {
	Optional<PublicPayment> findFirstByBookingIdOrderByCreatedAtDesc(UUID bookingId);
	Optional<PublicPayment> findFirstByBookingIdAndProviderKeyOrderByCreatedAtDesc(UUID bookingId, String providerKey);
	Optional<PublicPayment> findFirstByBookingIdAndIdempotencyKeyOrderByCreatedAtDesc(UUID bookingId, String idempotencyKey);
	Optional<PublicPayment> findFirstByBookingIdAndProviderKeyAndIdempotencyKeyOrderByCreatedAtDesc(UUID bookingId, String providerKey, String idempotencyKey);
	Optional<PublicPayment> findByProviderReference(String providerReference);
}

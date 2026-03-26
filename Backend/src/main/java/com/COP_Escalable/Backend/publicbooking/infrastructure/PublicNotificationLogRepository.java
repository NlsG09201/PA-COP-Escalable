package com.COP_Escalable.Backend.publicbooking.infrastructure;

import com.COP_Escalable.Backend.publicbooking.domain.PublicNotificationLog;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.UUID;

public interface PublicNotificationLogRepository extends MongoRepository<PublicNotificationLog, UUID> {
	List<PublicNotificationLog> findAllByBookingIdOrderByCreatedAtDesc(UUID bookingId);
	long countByBookingIdAndChannel(UUID bookingId, PublicNotificationLog.Channel channel);
}

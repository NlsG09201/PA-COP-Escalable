package com.COP_Escalable.Backend.notifications.infrastructure;

import com.COP_Escalable.Backend.notifications.domain.NotificationOutboxMessage;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface NotificationOutboxRepository extends MongoRepository<NotificationOutboxMessage, UUID> {
	boolean existsByAppointmentIdAndEventType(UUID appointmentId, String eventType);

	List<NotificationOutboxMessage> findTop50ByStatusInAndNextRelayAttemptAtLessThanEqualOrderByCreatedAtAsc(
			List<NotificationOutboxMessage.Status> statuses,
			Instant nextRelayAttemptAt
	);

	List<NotificationOutboxMessage> findTop50ByStatusAndDeliveryRetryAtLessThanEqualOrderByDeliveryRetryAtAsc(
			NotificationOutboxMessage.Status status,
			Instant deliveryRetryAt
	);
}

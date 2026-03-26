package com.COP_Escalable.Backend.notifications.infrastructure;

import com.COP_Escalable.Backend.notifications.domain.AlertAudience;
import com.COP_Escalable.Backend.notifications.domain.NotificationDelivery;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;
import java.util.UUID;

public interface NotificationDeliveryRepository extends MongoRepository<NotificationDelivery, UUID> {
	Optional<NotificationDelivery> findByOutboxMessageIdAndChannelAndAudienceAndRecipient(
			UUID outboxMessageId,
			NotificationDelivery.Channel channel,
			AlertAudience audience,
			String recipient
	);
}

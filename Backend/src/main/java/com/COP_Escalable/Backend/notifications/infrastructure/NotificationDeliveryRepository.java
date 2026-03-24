package com.COP_Escalable.Backend.notifications.infrastructure;

import com.COP_Escalable.Backend.notifications.domain.NotificationDelivery;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface NotificationDeliveryRepository extends JpaRepository<NotificationDelivery, UUID> {
	Optional<NotificationDelivery> findByOutboxMessageIdAndChannel(UUID outboxMessageId, NotificationDelivery.Channel channel);
}

package com.COP_Escalable.Backend.notifications.application;

import com.COP_Escalable.Backend.notifications.domain.NotificationOutboxMessage;
import com.COP_Escalable.Backend.notifications.infrastructure.NotificationOutboxRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class NotificationRetryScheduler {
	private static final Logger log = LoggerFactory.getLogger(NotificationRetryScheduler.class);

	private final NotificationOutboxRepository outboxRepository;
	private final NotificationStreamPublisher streamPublisher;
	private final NotificationProperties properties;

	public NotificationRetryScheduler(
			NotificationOutboxRepository outboxRepository,
			NotificationStreamPublisher streamPublisher,
			NotificationProperties properties
	) {
		this.outboxRepository = outboxRepository;
		this.streamPublisher = streamPublisher;
		this.properties = properties;
	}

	@Scheduled(fixedDelayString = "${app.notifications.redis.retry-poll-delay-ms:2000}")
	@Transactional
	public void republishDueRetries() {
		var dueMessages = outboxRepository.findTop50ByStatusAndDeliveryRetryAtLessThanEqualOrderByDeliveryRetryAtAsc(
				NotificationOutboxMessage.Status.PUBLISHED,
				Instant.now()
		);

		for (var message : dueMessages) {
			try {
				streamPublisher.publish(message, "delivery-retry");
				message.clearDeliveryRetry();
			} catch (RuntimeException ex) {
				log.warn("Unable to requeue delivery retry for outbox message {}: {}", message.getId(), ex.getMessage());
				message.scheduleDeliveryRetry(
						Instant.now().plusMillis(properties.retry().initialBackoffMs()),
						ex.getMessage()
				);
			}
		}
	}
}

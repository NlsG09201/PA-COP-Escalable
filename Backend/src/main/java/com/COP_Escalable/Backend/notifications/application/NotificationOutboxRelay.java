package com.COP_Escalable.Backend.notifications.application;

import com.COP_Escalable.Backend.notifications.domain.NotificationOutboxMessage;
import com.COP_Escalable.Backend.notifications.infrastructure.NotificationOutboxRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class NotificationOutboxRelay {
	private static final Logger log = LoggerFactory.getLogger(NotificationOutboxRelay.class);

	private final NotificationOutboxRepository outboxRepository;
	private final NotificationStreamPublisher streamPublisher;
	private final NotificationProperties properties;

	public NotificationOutboxRelay(
			NotificationOutboxRepository outboxRepository,
			NotificationStreamPublisher streamPublisher,
			NotificationProperties properties
	) {
		this.outboxRepository = outboxRepository;
		this.streamPublisher = streamPublisher;
		this.properties = properties;
	}

	@Scheduled(fixedDelayString = "${app.notifications.redis.relay-poll-delay-ms:2000}")
	@Transactional
	public void relayPendingMessages() {
		var messages = outboxRepository.findTop50ByStatusInAndNextRelayAttemptAtLessThanEqualOrderByCreatedAtAsc(
				List.of(NotificationOutboxMessage.Status.PENDING, NotificationOutboxMessage.Status.FAILED),
				Instant.now()
		);

		for (var message : messages) {
			try {
				streamPublisher.publish(message, "initial-relay");
				message.markPublished();
			} catch (RuntimeException ex) {
				log.warn("Unable to relay outbox message {} to Redis: {}", message.getId(), ex.getMessage());
				message.markRelayFailure(ex.getMessage(), Instant.now().plusMillis(computeBackoffMs(message.getRelayAttemptCount() + 1)));
			}
		}
	}

	private long computeBackoffMs(int attemptNumber) {
		double candidate = properties.retry().initialBackoffMs() * Math.pow(properties.retry().multiplier(), Math.max(0, attemptNumber - 1));
		return Math.min((long) candidate, properties.retry().maxBackoffMs());
	}
}

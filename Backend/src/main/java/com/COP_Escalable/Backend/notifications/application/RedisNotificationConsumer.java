package com.COP_Escalable.Backend.notifications.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Range;
import org.springframework.data.redis.connection.stream.Consumer;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.ReadOffset;
import org.springframework.data.redis.connection.stream.StreamReadOptions;
import org.springframework.data.redis.connection.stream.StreamOffset;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

@Service
public class RedisNotificationConsumer {
	private static final Logger log = LoggerFactory.getLogger(RedisNotificationConsumer.class);

	private final StringRedisTemplate redisTemplate;
	private final NotificationProperties properties;
	private final NotificationDeliveryService deliveryService;

	public RedisNotificationConsumer(
			StringRedisTemplate redisTemplate,
			NotificationProperties properties,
			NotificationDeliveryService deliveryService
	) {
		this.redisTemplate = redisTemplate;
		this.properties = properties;
		this.deliveryService = deliveryService;
	}

	@Scheduled(fixedDelayString = "${app.notifications.redis.consumer-poll-delay-ms:1000}")
	public void poll() {
		try {
			ensureConsumerGroup();
			processClaimedMessages();
			processRecords(readNewMessages());
		} catch (RuntimeException ex) {
			log.warn("Redis notification consumer poll failed: {}", ex.getMessage());
		}
	}

	private void ensureConsumerGroup() {
		try {
			redisTemplate.opsForStream().createGroup(
					properties.redis().stream(),
					ReadOffset.latest(),
					properties.redis().consumerGroup()
			);
		} catch (RuntimeException ex) {
			if (!isBusyGroup(ex)) {
				throw ex;
			}
		}
	}

	private void processClaimedMessages() {
		var pending = redisTemplate.opsForStream().pending(
				properties.redis().stream(),
				properties.redis().consumerGroup(),
				Range.unbounded(),
				properties.redis().batchSize(),
				Duration.ofMillis(properties.redis().claimIdleTimeMs())
		);

		if (pending == null || pending.isEmpty()) {
			return;
		}

		for (var pendingMessage : pending) {
			var claimed = redisTemplate.opsForStream().claim(
					properties.redis().stream(),
					properties.redis().consumerGroup(),
					properties.redis().consumerName(),
					Duration.ofMillis(properties.redis().claimIdleTimeMs()),
					pendingMessage.getId()
			);
			processRecords(claimed);
		}
	}

	private List<MapRecord<String, Object, Object>> readNewMessages() {
		return redisTemplate.opsForStream().read(
				Consumer.from(properties.redis().consumerGroup(), properties.redis().consumerName()),
				StreamReadOptions.empty()
						.count(properties.redis().batchSize())
						.block(Duration.ofMillis(properties.redis().readBlockMs())),
				StreamOffset.create(properties.redis().stream(), ReadOffset.lastConsumed())
		);
	}

	private void processRecords(List<MapRecord<String, Object, Object>> records) {
		if (records == null || records.isEmpty()) {
			return;
		}

		for (var record : records) {
			var rawOutboxMessageId = record.getValue().get("outboxMessageId");
			if (rawOutboxMessageId == null) {
				acknowledge(record);
				continue;
			}

			try {
				deliveryService.processOutboxMessage(UUID.fromString(rawOutboxMessageId.toString()));
				acknowledge(record);
			} catch (IllegalArgumentException ex) {
				log.error("Discarding invalid notification stream record {}: {}", record.getId(), ex.getMessage());
				acknowledge(record);
			} catch (RuntimeException ex) {
				log.error("Notification stream record {} failed and remains pending", record.getId(), ex);
			}
		}
	}

	private void acknowledge(MapRecord<String, Object, Object> record) {
		redisTemplate.opsForStream().acknowledge(
				properties.redis().stream(),
				properties.redis().consumerGroup(),
				record.getId()
		);
	}

	private boolean isBusyGroup(RuntimeException ex) {
		return ex.getMessage() != null && ex.getMessage().contains("BUSYGROUP");
	}
}

package com.COP_Escalable.Backend.aiassist.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
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
@ConditionalOnBean(StringRedisTemplate.class)
@ConditionalOnProperty(prefix = "app.ai-assist.redis-stream", name = "enabled", havingValue = "true", matchIfMissing = true)
public class AiAssistRedisStreamConsumer {

	private static final Logger log = LoggerFactory.getLogger(AiAssistRedisStreamConsumer.class);

	private final StringRedisTemplate redisTemplate;
	private final AiAssistProperties properties;
	private final AiAssistService aiAssistService;
	private final String consumerName;

	public AiAssistRedisStreamConsumer(
			StringRedisTemplate redisTemplate,
			AiAssistProperties properties,
			AiAssistService aiAssistService
	) {
		this.redisTemplate = redisTemplate;
		this.properties = properties;
		this.aiAssistService = aiAssistService;
		this.consumerName = properties.getRedisStream().effectiveConsumerName();
	}

	@Scheduled(fixedDelayString = "${app.ai-assist.redis-stream.consumer-poll-delay-ms:1000}")
	public void poll() {
		if (!properties.isEnabled() || !properties.isAsync() || !properties.getRedisStream().isEnabled()) {
			return;
		}
		try {
			var rs = properties.getRedisStream();
			ensureConsumerGroup();
			processClaimedMessages();
			processRecords(readNewMessages());
		} catch (RuntimeException ex) {
			log.warn("Redis AI assist stream poll failed: {}", ex.getMessage());
		}
	}

	private void ensureConsumerGroup() {
		var rs = properties.getRedisStream();
		try {
			redisTemplate.opsForStream().createGroup(
					rs.getStreamKey(),
					ReadOffset.latest(),
					rs.getConsumerGroup()
			);
		} catch (RuntimeException ex) {
			if (!isBusyGroup(ex)) {
				throw ex;
			}
		}
	}

	private void processClaimedMessages() {
		var rs = properties.getRedisStream();
		var pending = redisTemplate.opsForStream().pending(
				rs.getStreamKey(),
				rs.getConsumerGroup(),
				Range.unbounded(),
				rs.getBatchSize(),
				Duration.ofMillis(rs.getClaimIdleTimeMs())
		);

		if (pending == null || pending.isEmpty()) {
			return;
		}

		for (var pendingMessage : pending) {
			var claimed = redisTemplate.opsForStream().claim(
					rs.getStreamKey(),
					rs.getConsumerGroup(),
					consumerName,
					Duration.ofMillis(rs.getClaimIdleTimeMs()),
					pendingMessage.getId()
			);
			processRecords(claimed);
		}
	}

	private List<MapRecord<String, Object, Object>> readNewMessages() {
		var rs = properties.getRedisStream();
		return redisTemplate.opsForStream().read(
				Consumer.from(rs.getConsumerGroup(), consumerName),
				StreamReadOptions.empty()
						.count(rs.getBatchSize())
						.block(Duration.ofMillis(rs.getReadBlockMs())),
				StreamOffset.create(rs.getStreamKey(), ReadOffset.lastConsumed())
		);
	}

	private void processRecords(List<MapRecord<String, Object, Object>> records) {
		if (records == null || records.isEmpty()) {
			return;
		}

		for (var record : records) {
			var rawId = record.getValue().get("suggestionId");
			if (rawId == null) {
				acknowledge(record);
				continue;
			}

			UUID suggestionId;
			try {
				suggestionId = UUID.fromString(rawId.toString());
			} catch (IllegalArgumentException ex) {
				log.error("Discarding invalid AI assist stream record {}: {}", record.getId(), ex.getMessage());
				acknowledge(record);
				continue;
			}

			try {
				aiAssistService.processQueuedPsychTestAnalysis(suggestionId);
				acknowledge(record);
			} catch (RuntimeException ex) {
				log.error("AI assist stream record {} failed and remains pending for retry", record.getId(), ex);
			}
		}
	}

	private void acknowledge(MapRecord<String, Object, Object> record) {
		var rs = properties.getRedisStream();
		redisTemplate.opsForStream().acknowledge(
				rs.getStreamKey(),
				rs.getConsumerGroup(),
				record.getId()
		);
	}

	private static boolean isBusyGroup(RuntimeException ex) {
		return ex.getMessage() != null && ex.getMessage().contains("BUSYGROUP");
	}
}

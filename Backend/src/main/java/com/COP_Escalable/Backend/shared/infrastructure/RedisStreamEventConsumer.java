package com.COP_Escalable.Backend.shared.infrastructure;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.stream.*;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Reusable base for polling a Redis Stream consumer group.
 * Subclasses implement {@link #processRecord(String, Map)} and wire in
 * a {@code @Scheduled} method that calls {@link #poll()}.
 */
public abstract class RedisStreamEventConsumer {

	private final Logger log = LoggerFactory.getLogger(getClass());

	private final StringRedisTemplate redisTemplate;
	private final String streamKey;
	private final String consumerGroup;
	private final String consumerName;
	private final int batchSize;
	private final long readBlockMs;
	private final long claimIdleTimeMs;

	protected RedisStreamEventConsumer(
			StringRedisTemplate redisTemplate,
			String streamKey,
			String consumerGroup,
			String consumerName,
			int batchSize,
			long readBlockMs,
			long claimIdleTimeMs
	) {
		this.redisTemplate = redisTemplate;
		this.streamKey = streamKey;
		this.consumerGroup = consumerGroup;
		this.consumerName = consumerName != null && !consumerName.isBlank()
				? consumerName
				: "consumer-" + UUID.randomUUID().toString().substring(0, 8);
		this.batchSize = batchSize;
		this.readBlockMs = readBlockMs;
		this.claimIdleTimeMs = claimIdleTimeMs;
	}

	protected abstract void processRecord(String eventType, Map<String, String> fields);

	public void poll() {
		try {
			ensureConsumerGroup();
			reclaimStale();
			readAndProcess();
		} catch (RuntimeException ex) {
			log.warn("Stream poll [{}] failed: {}", streamKey, ex.getMessage());
		}
	}

	private void ensureConsumerGroup() {
		try {
			redisTemplate.opsForStream().createGroup(streamKey, ReadOffset.latest(), consumerGroup);
		} catch (RuntimeException ex) {
			if (ex.getMessage() == null || !ex.getMessage().contains("BUSYGROUP")) {
				throw ex;
			}
		}
	}

	private void reclaimStale() {
		var pending = redisTemplate.opsForStream().pending(
				streamKey, consumerGroup,
				org.springframework.data.domain.Range.unbounded(),
				batchSize,
				Duration.ofMillis(claimIdleTimeMs)
		);
		if (pending == null || pending.isEmpty()) return;

		for (var msg : pending) {
			var claimed = redisTemplate.opsForStream().claim(
					streamKey, consumerGroup, consumerName,
					Duration.ofMillis(claimIdleTimeMs), msg.getId()
			);
			process(claimed);
		}
	}

	private void readAndProcess() {
		List<MapRecord<String, Object, Object>> records = redisTemplate.opsForStream().read(
				Consumer.from(consumerGroup, consumerName),
				StreamReadOptions.empty()
						.count(batchSize)
						.block(Duration.ofMillis(readBlockMs)),
				StreamOffset.create(streamKey, ReadOffset.lastConsumed())
		);
		process(records);
	}

	@SuppressWarnings("unchecked")
	private void process(List<? extends MapRecord<String, ?, ?>> records) {
		if (records == null || records.isEmpty()) return;

		for (var record : records) {
			try {
				var raw = (Map<String, Object>) (Map<?, ?>) record.getValue();
				var fields = new java.util.LinkedHashMap<String, String>();
				raw.forEach((k, v) -> fields.put(k.toString(), v != null ? v.toString() : null));

				String eventType = fields.getOrDefault("eventType", "unknown");
				processRecord(eventType, fields);
				acknowledge(record);
			} catch (RuntimeException ex) {
				log.error("Failed to process record {} on stream {}: {}",
						record.getId(), streamKey, ex.getMessage(), ex);
			}
		}
	}

	private void acknowledge(MapRecord<String, ?, ?> record) {
		redisTemplate.opsForStream().acknowledge(streamKey, consumerGroup, record.getId());
	}
}

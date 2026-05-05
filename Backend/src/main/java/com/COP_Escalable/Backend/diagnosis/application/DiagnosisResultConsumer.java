package com.COP_Escalable.Backend.diagnosis.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@ConditionalOnBean(StringRedisTemplate.class)
@ConditionalOnProperty(prefix = "app.diagnosis.redis-stream", name = "enabled", havingValue = "true", matchIfMissing = true)
public class DiagnosisResultConsumer {

	private static final Logger log = LoggerFactory.getLogger(DiagnosisResultConsumer.class);

	private final StringRedisTemplate redisTemplate;
	private final DiagnosisProperties properties;
	private final DiagnosisService diagnosisService;
	private final String consumerName;

	public DiagnosisResultConsumer(
			StringRedisTemplate redisTemplate,
			DiagnosisProperties properties,
			DiagnosisService diagnosisService
	) {
		this.redisTemplate = redisTemplate;
		this.properties = properties;
		this.diagnosisService = diagnosisService;
		this.consumerName = properties.getRedisStream().effectiveConsumerName();
	}

	@Scheduled(fixedDelayString = "${app.diagnosis.redis-stream.poll-delay-ms:2000}")
	public void poll() {
		if (!properties.isAsync() || !properties.getRedisStream().isEnabled()) {
			return;
		}
		try {
			DiagnosisProperties.RedisStream rs = properties.getRedisStream();
			ensureConsumerGroup();
			processClaimedMessages();
			processRecords(readNewMessages());
		} catch (RuntimeException ex) {
			log.warn("Redis diagnosis stream poll failed: {}", ex.getMessage());
		}
	}

	private void ensureConsumerGroup() {
		DiagnosisProperties.RedisStream rs = properties.getRedisStream();
		try {
			redisTemplate.opsForStream().createGroup(
					rs.getResultsKey(),
					org.springframework.data.redis.connection.stream.ReadOffset.latest(),
					rs.getConsumerGroup()
			);
		} catch (RuntimeException ex) {
			if (!isBusyGroup(ex)) {
				throw ex;
			}
		}
	}

	private void processClaimedMessages() {
		DiagnosisProperties.RedisStream rs = properties.getRedisStream();
		var pending = redisTemplate.opsForStream().pending(
				rs.getResultsKey(),
				rs.getConsumerGroup(),
				org.springframework.data.domain.Range.unbounded(),
				rs.getBatchSize(),
				java.time.Duration.ofMillis(rs.getClaimIdleTimeMs())
		);

		if (pending == null || pending.isEmpty()) {
			return;
		}

		for (var pendingMessage : pending) {
			var claimed = redisTemplate.opsForStream().claim(
					rs.getResultsKey(),
					rs.getConsumerGroup(),
					consumerName,
					java.time.Duration.ofMillis(rs.getClaimIdleTimeMs()),
					pendingMessage.getId()
			);
			processRecords(claimed);
		}
	}

	@SuppressWarnings("unchecked")
	private List<MapRecord<String, Object, Object>> readNewMessages() {
		DiagnosisProperties.RedisStream rs = properties.getRedisStream();
		return redisTemplate.opsForStream().read(
				org.springframework.data.redis.connection.stream.Consumer.from(rs.getConsumerGroup(), consumerName),
				org.springframework.data.redis.connection.stream.StreamReadOptions.empty()
						.count(rs.getBatchSize())
						.block(java.time.Duration.ofMillis(rs.getReadBlockMs())),
				org.springframework.data.redis.connection.stream.StreamOffset.create(rs.getResultsKey(), org.springframework.data.redis.connection.stream.ReadOffset.lastConsumed())
		);
	}

	private void processRecords(List<MapRecord<String, Object, Object>> records) {
		if (records == null || records.isEmpty()) return;

		for (var record : records) {
			Object rawImageId = record.getValue().get("imageId");
			if (rawImageId == null) {
				acknowledge(record);
				continue;
			}

			String imageId = rawImageId.toString();
			Object rawData = record.getValue().get("data");
			String resultJson = rawData != null ? rawData.toString() : "{}";

			try {
				diagnosisService.processAsyncResult(imageId, resultJson);
				acknowledge(record);
			} catch (Exception ex) {
				log.error("Diagnosis result record {} failed and remains pending for retry", record.getId(), ex);
			}
		}
	}

	private boolean isBusyGroup(RuntimeException ex) {
		String msg = ex.getMessage();
		return msg != null && (msg.contains("BUSYGROUP") || msg.contains("Already exists"));
	}

	private void acknowledge(MapRecord<String, Object, Object> record) {
		DiagnosisProperties.RedisStream rs = properties.getRedisStream();
		redisTemplate.opsForStream().acknowledge(
				rs.getResultsKey(),
				rs.getConsumerGroup(),
				record.getId()
		);
		redisTemplate.opsForStream().delete(rs.getResultsKey(), record.getId());
	}
}
